/**
 * Community Registry Client — FR-065, FR-068, FR-069
 * Fetches marketplace listings from a registry endpoint.
 * Falls back to cached data when offline.
 */
import type {
  MarketplaceListing,
  ContentCategory,
  MarketplaceSortOption,
  RegistryIndex,
  Review,
  CreatorProfile,
} from "./types";

const REGISTRY_URL = "https://raw.githubusercontent.com/hugbrowse/community-registry/main";
const CACHE_KEY = "hugbrowse-marketplace-cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedRegistry {
  fetchedAt: number;
  data: RegistryIndex;
}

class RegistryClient {
  private cache: CachedRegistry | null = null;
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private headers(): HeadersInit {
    const h: HeadersInit = { Accept: "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  /** FR-068: Load cached registry from localStorage */
  private loadCache(): CachedRegistry | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CachedRegistry;
    } catch {
      return null;
    }
  }

  /** FR-068: Save registry to localStorage cache */
  private saveCache(data: RegistryIndex): void {
    try {
      const cached: CachedRegistry = { fetchedAt: Date.now(), data };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      this.cache = cached;
    } catch {
      /* quota exceeded */
    }
  }

  /** Check if cache is stale (> 7 days) */
  isCacheStale(): boolean {
    const cached = this.cache ?? this.loadCache();
    if (!cached) return true;
    return Date.now() - cached.fetchedAt > CACHE_TTL_MS;
  }

  /** FR-065: Fetch full registry index */
  async fetchIndex(): Promise<{ data: RegistryIndex; fromCache: boolean; stale: boolean }> {
    try {
      const res = await fetch(`${REGISTRY_URL}/index.json`, {
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`Registry HTTP ${res.status}`);
      const data = (await res.json()) as RegistryIndex;
      this.saveCache(data);
      return { data, fromCache: false, stale: false };
    } catch {
      // FR-068: Fallback to cache when offline
      const cached = this.cache ?? this.loadCache();
      if (cached) {
        return {
          data: cached.data,
          fromCache: true,
          stale: this.isCacheStale(),
        };
      }
      // No cache available — return empty
      return {
        data: { version: 0, updatedAt: 0, listings: [] },
        fromCache: true,
        stale: true,
      };
    }
  }

  /** FR-072: Search listings with fuzzy matching */
  searchListings(
    listings: MarketplaceListing[],
    query: string,
    category?: ContentCategory,
    sort: MarketplaceSortOption = "trending",
  ): MarketplaceListing[] {
    let results = [...listings];

    // Category filter
    if (category) {
      results = results.filter((l) => l.category === category);
    }

    // FR-072: Fuzzy search across name, description, tags, author
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q)) ||
          l.authorName.toLowerCase().includes(q),
      );
    }

    // FR-074: Sort
    switch (sort) {
      case "downloads":
        results.sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      case "rating":
        results.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case "newest":
        results.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "updated":
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case "trending":
      default:
        // Trending = weighted score of recent downloads + rating
        results.sort((a, b) => {
          const now = Date.now();
          const recencyA = 1 / (1 + (now - a.updatedAt) / 86400000);
          const recencyB = 1 / (1 + (now - b.updatedAt) / 86400000);
          const scoreA = a.downloadCount * 0.3 + a.averageRating * 0.4 + recencyA * 0.3;
          const scoreB = b.downloadCount * 0.3 + b.averageRating * 0.4 + recencyB * 0.3;
          return scoreB - scoreA;
        });
        break;
    }

    return results;
  }

  /** FR-070: Fetch reviews for a listing */
  async fetchReviews(listingId: string): Promise<Review[]> {
    try {
      const res = await fetch(`${REGISTRY_URL}/reviews/${listingId}.json`, {
        headers: this.headers(),
      });
      if (!res.ok) return [];
      return (await res.json()) as Review[];
    } catch {
      return [];
    }
  }

  /** FR-100: Fetch creator profile */
  async fetchCreatorProfile(authorId: string): Promise<CreatorProfile | null> {
    try {
      const res = await fetch(`${REGISTRY_URL}/creators/${authorId}.json`, {
        headers: this.headers(),
      });
      if (!res.ok) return null;
      return (await res.json()) as CreatorProfile;
    } catch {
      return null;
    }
  }

  /** FR-077: Get featured listings */
  getFeatured(listings: MarketplaceListing[]): MarketplaceListing[] {
    return listings.filter((l) => l.featured);
  }

  /** FR-077: Get trending listings (top 10 by trending score) */
  getTrending(listings: MarketplaceListing[]): MarketplaceListing[] {
    return this.searchListings(listings, "", undefined, "trending").slice(0, 10);
  }

  /** FR-077: Get newest listings */
  getNewReleases(listings: MarketplaceListing[]): MarketplaceListing[] {
    return this.searchListings(listings, "", undefined, "newest").slice(0, 10);
  }

  /** FR-101: Get recommended based on hardware tier */
  getRecommended(
    listings: MarketplaceListing[],
    hardwareTier?: string,
  ): MarketplaceListing[] {
    if (!hardwareTier) return this.getTrending(listings);
    return listings
      .filter(
        (l) =>
          !l.compatibility.hardwareTiers ||
          l.compatibility.hardwareTiers.length === 0 ||
          l.compatibility.hardwareTiers.includes(hardwareTier),
      )
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 10);
  }

  /** FR-098: Fetch all creator profiles for community page */
  async fetchCreators(): Promise<CreatorProfile[]> {
    try {
      const res = await fetch(`${REGISTRY_URL}/creators/index.json`, {
        headers: this.headers(),
      });
      if (!res.ok) return [];
      return (await res.json()) as CreatorProfile[];
    } catch {
      return [];
    }
  }
}

export const registryClient = new RegistryClient();
