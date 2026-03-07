/** FR-100: Creator profile page */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMarketplace } from "../../stores/marketplace";
import { registryClient } from "../../lib/marketplace/registry-client";
import { MarketplaceListingCard } from "../../components/marketplace/ListingCard";
import type { CreatorProfile } from "../../lib/marketplace/types";
import {
  ArrowLeft,
  Star,
  Download,
  Package,
  ExternalLink,
  UserPlus,
  Users,
} from "lucide-react";

export function CreatorProfilePage() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const navigate = useNavigate();
  const { listings } = useMarketplace();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [following, setFollowing] = useState<boolean>(() => {
    const saved = localStorage.getItem("hugbrowse-following");
    return saved ? (JSON.parse(saved) as string[]).includes(creatorId ?? "") : false;
  });

  useEffect(() => {
    if (!creatorId) return;
    registryClient.fetchCreators().then((creators) => {
      const found = creators.find((c) => c.id === creatorId);
      if (found) setCreator(found);
    });
  }, [creatorId]);

  const toggleFollow = () => {
    const saved = localStorage.getItem("hugbrowse-following");
    const set = new Set<string>(saved ? JSON.parse(saved) : []);
    if (set.has(creatorId!)) {
      set.delete(creatorId!);
      setFollowing(false);
    } else {
      set.add(creatorId!);
      setFollowing(true);
    }
    localStorage.setItem("hugbrowse-following", JSON.stringify([...set]));
  };

  const creatorListings = listings.filter((l) => l.authorId === creatorId);
  const totalDownloads = creatorListings.reduce((sum, l) => sum + l.downloadCount, 0);
  const avgRating =
    creatorListings.length > 0
      ? creatorListings.reduce((sum, l) => sum + l.averageRating, 0) / creatorListings.length
      : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xl font-bold">
            {creator?.displayName?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">
              {creator?.displayName ?? creatorId}
            </h1>
            {creator?.bio && (
              <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">{creator.bio}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {creator?.hfProfileUrl && (
              <a
                href={creator.hfProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> HF Profile
              </a>
            )}
            <button
              onClick={toggleFollow}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                following
                  ? "bg-accent/10 text-accent"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {following ? "Following" : "Follow"}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Package className="h-3.5 w-3.5" />
            <span className="font-semibold text-[var(--foreground)]">{creatorListings.length}</span> extensions
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Download className="h-3.5 w-3.5" />
            <span className="font-semibold text-[var(--foreground)]">{totalDownloads.toLocaleString()}</span> downloads
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Star className="h-3.5 w-3.5 text-yellow-500" />
            <span className="font-semibold text-[var(--foreground)]">{avgRating.toFixed(1)}</span> avg rating
          </div>
          {creator && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <Users className="h-3.5 w-3.5" />
              <span className="font-semibold text-[var(--foreground)]">{creator.followersCount.toLocaleString()}</span> followers
            </div>
          )}
        </div>

        {/* Badges */}
        {creator && creator.badges.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {creator.badges.map((badge) => (
              <span
                key={badge}
                className="text-[10px] px-2 py-0.5 rounded-full bg-accent/5 text-accent border border-accent/10"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Published extensions */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Published Extensions
        </h2>
        {creatorListings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creatorListings.map((listing) => (
              <MarketplaceListingCard
                key={listing.id}
                listing={listing}
                onClick={() => {}}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-8 w-8 text-[var(--muted)] mx-auto mb-2 opacity-30" />
            <p className="text-sm text-[var(--muted)]">No published extensions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
