import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  MarketplaceListing,
  InstalledExtension,
  ContentCategory,
  MarketplaceSortOption,
  CommunityModel,
} from "../lib/marketplace/types";
import { registryClient } from "../lib/marketplace/registry-client";

interface MarketplaceStore {
  // Registry state
  listings: MarketplaceListing[];
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  stale: boolean;
  lastFetched: number | null;

  // Search/filter state
  searchQuery: string;
  activeCategory: ContentCategory | null;
  sortBy: MarketplaceSortOption;

  // Installed extensions
  installed: InstalledExtension[];

  // Community models
  communityModels: CommunityModel[];

  // Active embedding model
  activeEmbeddingModelId: string | null;

  // Actions
  fetchRegistry: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: ContentCategory | null) => void;
  setSortBy: (sort: MarketplaceSortOption) => void;
  installExtension: (listing: MarketplaceListing) => Promise<void>;
  uninstallExtension: (id: string) => void;
  enableExtension: (id: string) => void;
  disableExtension: (id: string) => void;
  updateExtension: (id: string) => Promise<void>;
  installCommunityModel: (listing: MarketplaceListing) => Promise<void>;
  setActiveEmbeddingModel: (id: string | null) => void;

  // Computed
  getFilteredListings: () => MarketplaceListing[];
  getFeatured: () => MarketplaceListing[];
  getTrending: () => MarketplaceListing[];
  getNewReleases: () => MarketplaceListing[];
  getRecommended: (tier?: string) => MarketplaceListing[];
  getInstalledByCategory: (category: ContentCategory) => InstalledExtension[];
}

export const useMarketplace = create<MarketplaceStore>()(
  persist(
    (set, get) => ({
      listings: [],
      loading: false,
      error: null,
      fromCache: false,
      stale: false,
      lastFetched: null,
      searchQuery: "",
      activeCategory: null,
      sortBy: "trending" as MarketplaceSortOption,
      installed: [],
      communityModels: [],
      activeEmbeddingModelId: null,

      fetchRegistry: async () => {
        set({ loading: true, error: null });
        try {
          const result = await registryClient.fetchIndex();
          set({
            listings: result.data.listings,
            fromCache: result.fromCache,
            stale: result.stale,
            lastFetched: Date.now(),
            loading: false,
          });
        } catch (e) {
          set({ error: String(e), loading: false });
        }
      },

      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveCategory: (category) => set({ activeCategory: category }),
      setSortBy: (sort) => set({ sortBy: sort }),

      installExtension: async (listing) => {
        const ext: InstalledExtension = {
          id: crypto.randomUUID(),
          listingId: listing.id,
          name: listing.name,
          version: listing.version,
          category: listing.category,
          installPath: `extensions/${listing.id}`,
          enabled: true,
          permissions: [],
          installedAt: Date.now(),
          lastUpdated: Date.now(),
          config: {},
          status: "active",
        };
        set((s) => ({ installed: [...s.installed, ext] }));
      },

      uninstallExtension: (id) =>
        set((s) => ({ installed: s.installed.filter((e) => e.id !== id) })),

      enableExtension: (id) =>
        set((s) => ({
          installed: s.installed.map((e) =>
            e.id === id ? { ...e, enabled: true, status: "active" as const } : e,
          ),
        })),

      disableExtension: (id) =>
        set((s) => ({
          installed: s.installed.map((e) =>
            e.id === id ? { ...e, enabled: false, status: "disabled" as const } : e,
          ),
        })),

      updateExtension: async (id) => {
        const ext = get().installed.find((e) => e.id === id);
        if (!ext?.updateAvailable) return;
        set((s) => ({
          installed: s.installed.map((e) =>
            e.id === id
              ? { ...e, version: e.updateAvailable!, updateAvailable: undefined, lastUpdated: Date.now() }
              : e,
          ),
        }));
      },

      installCommunityModel: async (listing) => {
        const model: CommunityModel = {
          id: crypto.randomUUID(),
          listingId: listing.id,
          filename: listing.name + ".gguf",
          filePath: `community-models/${listing.id}`,
          fileSize: listing.fileSize,
          checksum: listing.checksum,
          category: "embedding",
          quantization: listing.tags.find((t) => t.startsWith("q")) ?? "unknown",
          parameterCount: 0,
          contextLengths: [2048, 4096],
          downloadDate: Date.now(),
          integrityOk: true,
        };
        set((s) => ({ communityModels: [...s.communityModels, model] }));
      },

      setActiveEmbeddingModel: (id) => set({ activeEmbeddingModelId: id }),

      getFilteredListings: () => {
        const { listings, searchQuery, activeCategory, sortBy } = get();
        return registryClient.searchListings(listings, searchQuery, activeCategory ?? undefined, sortBy);
      },

      getFeatured: () => registryClient.getFeatured(get().listings),
      getTrending: () => registryClient.getTrending(get().listings),
      getNewReleases: () => registryClient.getNewReleases(get().listings),
      getRecommended: (tier) => registryClient.getRecommended(get().listings, tier),

      getInstalledByCategory: (category) =>
        get().installed.filter((e) => e.category === category),
    }),
    {
      name: "hugbrowse-marketplace",
      partialize: (s) => ({
        installed: s.installed,
        communityModels: s.communityModels,
        activeEmbeddingModelId: s.activeEmbeddingModelId,
      }),
    },
  ),
);
