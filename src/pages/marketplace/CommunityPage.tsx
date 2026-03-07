/** FR-098: Community discovery page */
import { useState, useEffect } from "react";
import { useMarketplace } from "../../stores/marketplace";
import { registryClient } from "../../lib/marketplace/registry-client";
import { MarketplaceListingCard } from "../../components/marketplace/ListingCard";
import type { CreatorProfile } from "../../lib/marketplace/types";
import { Users, TrendingUp, Sparkles, UserPlus, Heart } from "lucide-react";

export function CommunityPage() {
  const { listings } = useMarketplace();
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [following, setFollowing] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("hugbrowse-following");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [activeTab, setActiveTab] = useState<"trending" | "creators" | "following">("trending");

  useEffect(() => {
    registryClient.fetchCreators().then(setCreators);
  }, []);

  const toggleFollow = (creatorId: string) => {
    setFollowing((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      localStorage.setItem("hugbrowse-following", JSON.stringify([...next]));
      return next;
    });
  };

  const trendingListings = [...listings]
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, 12);

  const followedCreatorListings = listings.filter((l) => following.has(l.authorId));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" /> Community
        </h1>
        <p className="text-xs text-[var(--muted)] mt-1">
          Discover creators, trending content, and follow your favorites
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--border)]">
        {([
          { id: "trending" as const, label: "Trending", icon: TrendingUp },
          { id: "creators" as const, label: "Creators", icon: Sparkles },
          { id: "following" as const, label: "Following", icon: Heart },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "trending" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {trendingListings.map((listing) => (
              <MarketplaceListingCard key={listing.id} listing={listing} onClick={() => {}} />
            ))}
          </div>
        )}

        {activeTab === "creators" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {creators.map((creator) => (
              <div
                key={creator.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                    {creator.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{creator.displayName}</h3>
                    <p className="text-[10px] text-[var(--muted)]">
                      {creator.totalDownloads.toLocaleString()} total downloads
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFollow(creator.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                      following.has(creator.id)
                        ? "bg-accent/10 text-accent"
                        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <UserPlus className="h-3 w-3" />
                    {following.has(creator.id) ? "Following" : "Follow"}
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)] line-clamp-2">{creator.bio}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {creator.badges.slice(0, 3).map((badge) => (
                    <span key={badge} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/5 text-accent">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {creators.length === 0 && (
              <p className="text-sm text-[var(--muted)] col-span-3 text-center py-12">
                Loading creators...
              </p>
            )}
          </div>
        )}

        {activeTab === "following" && (
          <>
            {following.size === 0 ? (
              <div className="text-center py-12">
                <Heart className="h-10 w-10 text-[var(--border)] mx-auto mb-3" />
                <p className="text-sm text-[var(--muted)]">
                  Follow creators to see their latest content here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {followedCreatorListings.map((listing) => (
                  <MarketplaceListingCard key={listing.id} listing={listing} onClick={() => {}} />
                ))}
                {followedCreatorListings.length === 0 && (
                  <p className="text-sm text-[var(--muted)] col-span-3 text-center py-12">
                    Creators you follow haven't published anything yet
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
