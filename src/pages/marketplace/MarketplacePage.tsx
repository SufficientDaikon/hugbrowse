/** FR-071 through FR-078: Marketplace Page */
import { useEffect, useState } from "react";
import { useMarketplace } from "../../stores/marketplace";
import { MarketplaceListingCard } from "../../components/marketplace/ListingCard";
import { MarketplaceDetail } from "../../components/marketplace/ListingDetail";
import type { ContentCategory, MarketplaceListing, MarketplaceSortOption } from "../../lib/marketplace/types";
import {
  Search,
  Store,
  Puzzle,
  Server,
  GitBranch,
  Sparkles,
  Brain,
  TrendingUp,
  Star,
  Clock,
  RefreshCw,
  WifiOff,
  Package,
} from "lucide-react";

const CATEGORIES: { id: ContentCategory | null; label: string; icon: React.ReactNode }[] = [
  { id: null, label: "All", icon: <Store className="h-3.5 w-3.5" /> },
  { id: "models", label: "Models", icon: <Brain className="h-3.5 w-3.5" /> },
  { id: "plugins", label: "Plugins", icon: <Puzzle className="h-3.5 w-3.5" /> },
  { id: "mcp-servers", label: "MCP Servers", icon: <Server className="h-3.5 w-3.5" /> },
  { id: "workflows", label: "Workflows", icon: <GitBranch className="h-3.5 w-3.5" /> },
  { id: "skills", label: "Skills", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

const SORT_OPTIONS: { value: MarketplaceSortOption; label: string; icon: React.ReactNode }[] = [
  { value: "trending", label: "Trending", icon: <TrendingUp className="h-3 w-3" /> },
  { value: "downloads", label: "Downloads", icon: <Package className="h-3 w-3" /> },
  { value: "rating", label: "Rating", icon: <Star className="h-3 w-3" /> },
  { value: "newest", label: "Newest", icon: <Clock className="h-3 w-3" /> },
  { value: "updated", label: "Updated", icon: <RefreshCw className="h-3 w-3" /> },
];

export function MarketplacePage() {
  const {
    loading,
    error,
    fromCache,
    stale,
    searchQuery,
    activeCategory,
    sortBy,
    installed,
    fetchRegistry,
    setSearchQuery,
    setActiveCategory,
    setSortBy,
    getFilteredListings,
    getFeatured,
    getTrending,
    getNewReleases,
  } = useMarketplace();

  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [view, setView] = useState<"browse" | "installed">("browse");

  // Fetch registry on mount
  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const filteredListings = getFilteredListings();
  const featured = getFeatured();
  const trending = getTrending();
  const newReleases = getNewReleases();
  const isSearching = searchQuery.length > 0 || activeCategory !== null;

  if (selectedListing) {
    return (
      <MarketplaceDetail
        listing={selectedListing}
        onBack={() => setSelectedListing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold">Marketplace</h1>
            {stale && fromCache && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
                <WifiOff className="h-3 w-3" /> Cached (offline)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("browse")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                view === "browse"
                  ? "bg-accent text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setView("installed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                view === "installed"
                  ? "bg-accent text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Installed ({installed.length})
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search extensions, models, plugins..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                activeCategory === cat.id
                  ? "bg-accent text-white border-accent"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20"
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}

          {/* Sort dropdown */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as MarketplaceSortOption)}
              className="text-xs bg-transparent border border-[var(--border)] rounded-lg px-2 py-1.5 text-[var(--foreground)] focus:outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 text-accent animate-spin" />
            <span className="ml-2 text-sm text-[var(--muted)]">Loading marketplace...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={fetchRegistry}
              className="mt-2 text-xs text-accent hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && view === "browse" && (
          <>
            {isSearching ? (
              /* Search results */
              <div>
                <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                  {filteredListings.length} result{filteredListings.length !== 1 ? "s" : ""}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredListings.map((listing) => (
                    <MarketplaceListingCard
                      key={listing.id}
                      listing={listing}
                      onClick={() => setSelectedListing(listing)}
                    />
                  ))}
                </div>
                {filteredListings.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="h-8 w-8 text-[var(--muted)] mx-auto mb-2 opacity-30" />
                    <p className="text-sm text-[var(--muted)]">No results found</p>
                  </div>
                )}
              </div>
            ) : (
              /* Home sections */
              <div className="space-y-8">
                {/* Featured */}
                {featured.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-yellow-500" /> Featured
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {featured.map((listing) => (
                        <MarketplaceListingCard
                          key={listing.id}
                          listing={listing}
                          onClick={() => setSelectedListing(listing)}
                          featured
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Trending */}
                {trending.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-accent" /> Trending This Week
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {trending.map((listing) => (
                        <MarketplaceListingCard
                          key={listing.id}
                          listing={listing}
                          onClick={() => setSelectedListing(listing)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* New Releases */}
                {newReleases.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-green-500" /> New Releases
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {newReleases.map((listing) => (
                        <MarketplaceListingCard
                          key={listing.id}
                          listing={listing}
                          onClick={() => setSelectedListing(listing)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Empty state */}
                {featured.length === 0 && trending.length === 0 && (
                  <div className="text-center py-16">
                    <Store className="h-12 w-12 text-[var(--muted)] mx-auto mb-3 opacity-20" />
                    <h3 className="text-lg font-semibold mb-1">Marketplace Coming Soon</h3>
                    <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
                      The community marketplace is being built. Soon you'll be able to discover and
                      install models, plugins, MCP servers, workflows, and skills created by the community.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!loading && view === "installed" && (
          <div>
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
              Installed ({installed.length})
            </h2>
            {installed.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-8 w-8 text-[var(--muted)] mx-auto mb-2 opacity-30" />
                <p className="text-sm text-[var(--muted)]">No extensions installed yet</p>
                <button
                  onClick={() => setView("browse")}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  Browse marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {installed.map((ext) => (
                  <InstalledExtensionRow key={ext.id} extension={ext} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InstalledExtensionRow({ extension }: { extension: import("../../lib/marketplace/types").InstalledExtension }) {
  const { uninstallExtension, enableExtension, disableExtension, listings } = useMarketplace();

  // EC-13: Check if creator deleted the published extension
  const listingExists = extension.listingId
    ? listings.some((l) => l.id === extension.listingId)
    : true;

  const categoryColors: Record<string, string> = {
    models: "bg-blue-500/10 text-blue-600",
    plugins: "bg-purple-500/10 text-purple-600",
    "mcp-servers": "bg-green-500/10 text-green-600",
    workflows: "bg-orange-500/10 text-orange-600",
    skills: "bg-pink-500/10 text-pink-600",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">{extension.name}</h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColors[extension.category] ?? "bg-gray-500/10 text-gray-600"}`}>
            {extension.category}
          </span>
          <span className="text-[10px] text-[var(--muted)] font-mono">v{extension.version}</span>
          {extension.updateAvailable && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
              Update: v{extension.updateAvailable}
            </span>
          )}
          {/* EC-13: Warn if extension was removed from registry */}
          {!listingExists && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
              No longer available
            </span>
          )}
        </div>
        <p className="text-[10px] text-[var(--muted)] mt-0.5">
          {extension.status === "errored" ? `⚠️ ${extension.error}` : `Installed ${new Date(extension.installedAt).toLocaleDateString()}`}
        </p>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => extension.enabled ? disableExtension(extension.id) : enableExtension(extension.id)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            extension.enabled
              ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
              : "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20"
          }`}
        >
          {extension.enabled ? "Enabled" : "Disabled"}
        </button>
        <button
          onClick={() => uninstallExtension(extension.id)}
          className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
        >
          Uninstall
        </button>
      </div>
    </div>
  );
}
