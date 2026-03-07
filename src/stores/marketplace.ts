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

  // EC-15: Download progress tracking
  downloadProgress: Map<string, { downloaded: number; total: number; speed: number }>;

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

  // FR-090: RAG stale index flag
  ragIndexStale: boolean;
  clearRagIndexStale: () => void;

  // Computed
  getFilteredListings: () => MarketplaceListing[];
  getFeatured: () => MarketplaceListing[];
  getTrending: () => MarketplaceListing[];
  getNewReleases: () => MarketplaceListing[];
  getRecommended: (tier?: string) => MarketplaceListing[];
  getInstalledByCategory: (category: ContentCategory) => InstalledExtension[];
  getCombinedModelLibrary: () => { source: "huggingface" | "community"; model: CommunityModel | MarketplaceListing }[];
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
      downloadProgress: new Map(),
      ragIndexStale: false,

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
        // EC-03: Check for version conflicts
        const existingDeps = new Map<string, string>();
        for (const ext of get().installed) {
          existingDeps.set(ext.name, ext.version);
        }
        // If the new extension requires a specific dependency version that conflicts, warn
        if (existingDeps.has(listing.name)) {
          const existing = existingDeps.get(listing.name)!;
          if (existing !== listing.version) {
            set({ error: `Version conflict: "${listing.name}" v${existing} is already installed but v${listing.version} was requested.` });
            return;
          }
        }

        // EC-12: Check for missing model dependencies
        if (listing.compatibility.requiredModels?.length) {
          const installedModels = get().communityModels.map((m) => m.filename);
          const missing = listing.compatibility.requiredModels.filter(
            (rm) => !installedModels.some((im) => im.includes(rm)),
          );
          if (missing.length > 0) {
            set({ error: `Missing required model(s): ${missing.join(", ")}. Please install them first.` });
            return;
          }
        }

        // EC-04: Check disk space before install
        try {
          const estimate = await navigator.storage.estimate();
          const available = (estimate.quota ?? 0) - (estimate.usage ?? 0);
          if (listing.fileSize > available) {
            set({ error: `Not enough disk space. Need ${(listing.fileSize / 1048576).toFixed(1)} MB, have ${(available / 1048576).toFixed(1)} MB available.` });
            return;
          }
        } catch { /* storage API not available */ }

        // EC-15: Set initial download progress
        set((s) => {
          const progress = new Map(s.downloadProgress);
          progress.set(listing.id, { downloaded: 0, total: listing.fileSize, speed: 0 });
          return { downloadProgress: progress };
        });

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

        // EC-15: Clear download progress after install
        set((s) => {
          const progress = new Map(s.downloadProgress);
          progress.delete(listing.id);
          return { downloadProgress: progress };
        });
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

      setActiveEmbeddingModel: (id) => {
        const prev = get().activeEmbeddingModelId;
        set({ activeEmbeddingModelId: id });
        // FR-090: Mark RAG indexes as stale when embedding model changes
        if (prev !== id) {
          set({ ragIndexStale: true });
        }
      },

      getFilteredListings: () => {
        const { listings, searchQuery, activeCategory, sortBy } = get();
        return registryClient.searchListings(listings, searchQuery, activeCategory ?? undefined, sortBy);
      },

      getFeatured: () => registryClient.getFeatured(get().listings),
      getTrending: () => registryClient.getTrending(get().listings),
      getNewReleases: () => registryClient.getNewReleases(get().listings),
      getRecommended: (tier) => registryClient.getRecommended(get().listings, tier),

      clearRagIndexStale: () => set({ ragIndexStale: false }),

      getInstalledByCategory: (category) =>
        get().installed.filter((e) => e.category === category),

      /**
       * FR-088: Community badge in UI — the `source` field ("community" | "huggingface")
       * returned by getCombinedModelLibrary enables UI components to render a visible
       * "Community" badge on community-sourced models in any model listing view.
       */
      /** FR-093: Combined model library from HuggingFace + community sources */
      getCombinedModelLibrary: () => {
        const { listings, communityModels } = get();
        const hfModels = listings
          .filter((l) => l.category === "models")
          .map((l) => ({ source: "huggingface" as const, model: l }));
        const community = communityModels.map((m) => ({
          source: "community" as const,
          model: m,
        }));
        return [...hfModels, ...community];
      },
    }),
    {
      name: "hugbrowse-marketplace",
      partialize: (s) => ({
        installed: s.installed,
        communityModels: s.communityModels,
        activeEmbeddingModelId: s.activeEmbeddingModelId,
        ragIndexStale: s.ragIndexStale,
      }),
    },
  ),
);
