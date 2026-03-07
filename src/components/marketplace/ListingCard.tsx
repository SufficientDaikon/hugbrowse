/** FR-075: Marketplace listing card component */
import type { MarketplaceListing } from "../../lib/marketplace/types";
import { Star, Download, Brain, Puzzle, Server, GitBranch, Sparkles } from "lucide-react";

interface Props {
  listing: MarketplaceListing;
  onClick: () => void;
  featured?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  models: <Brain className="h-3.5 w-3.5" />,
  plugins: <Puzzle className="h-3.5 w-3.5" />,
  "mcp-servers": <Server className="h-3.5 w-3.5" />,
  workflows: <GitBranch className="h-3.5 w-3.5" />,
  skills: <Sparkles className="h-3.5 w-3.5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  models: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  plugins: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "mcp-servers": "bg-green-500/10 text-green-600 border-green-500/20",
  workflows: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  skills: "bg-pink-500/10 text-pink-600 border-pink-500/20",
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function MarketplaceListingCard({ listing, onClick, featured }: Props) {
  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-xl border p-4 transition-all hover:shadow-md hover:border-accent/30 ${
        featured
          ? "border-accent/30 bg-accent/5"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--background)] border border-[var(--border)]">
          {CATEGORY_ICONS[listing.category] ?? <Puzzle className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold truncate">{listing.name}</h3>
          <p className="text-[10px] text-[var(--muted)] truncate">
            by {listing.authorName}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--muted)] line-clamp-2 mb-3 leading-relaxed">
        {listing.description.replace(/[#*_`]/g, "").slice(0, 120)}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
            CATEGORY_COLORS[listing.category] ?? "bg-gray-500/10 text-gray-600 border-gray-500/20"
          }`}
        >
          {CATEGORY_ICONS[listing.category]}
          {listing.category}
        </span>

        <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          {listing.averageRating.toFixed(1)}
        </span>

        <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
          <Download className="h-3 w-3" />
          {formatCount(listing.downloadCount)}
        </span>

        {listing.fileSize > 0 && (
          <span className="text-[10px] text-[var(--muted)] ml-auto">
            {formatSize(listing.fileSize)}
          </span>
        )}
      </div>

      {/* Tags */}
      {listing.tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {listing.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]"
            >
              {tag}
            </span>
          ))}
          {listing.tags.length > 3 && (
            <span className="text-[9px] text-[var(--muted)]">
              +{listing.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
