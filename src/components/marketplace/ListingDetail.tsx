/** FR-076: Marketplace listing detail page */
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarketplaceListing, Review } from "../../lib/marketplace/types";
import { useMarketplace } from "../../stores/marketplace";
import { registryClient } from "../../lib/marketplace/registry-client";
import {
  ArrowLeft,
  Download,
  Star,
  Clock,
  Shield,
  User,
  Package,
  Check,
  ExternalLink,
  Flag,
} from "lucide-react";

interface Props {
  listing: MarketplaceListing;
  onBack: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_024).toFixed(0)} KB`;
}

export function MarketplaceDetail({ listing, onBack }: Props) {
  const { installed, installExtension } = useMarketplace();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [installing, setInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "reviews" | "versions">("details");
  const [userRating, setUserRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const isInstalled = installed.some((e) => e.listingId === listing.id);

  useEffect(() => {
    registryClient.fetchReviews(listing.id).then(setReviews);
  }, [listing.id]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await installExtension(listing);
    } finally {
      setInstalling(false);
    }
  };

  const handleSubmitReview = () => {
    if (userRating === 0) return;
    // FR-094: Submit review (would POST to registry)
    const review: Review = {
      id: crypto.randomUUID(),
      listingId: listing.id,
      authorId: "local-user",
      authorName: "You",
      rating: userRating,
      text: reviewText,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      flagged: false,
    };
    setReviews((prev) => [review, ...prev]);
    setUserRating(0);
    setReviewText("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back header */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero section */}
        <div className="px-6 py-6 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent text-2xl font-bold">
              {listing.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold mb-1">{listing.name}</h1>
              <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> {listing.authorName}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  {listing.averageRating.toFixed(1)} ({listing.reviewCount} reviews)
                </span>
                <span className="flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" />
                  {listing.downloadCount.toLocaleString()} downloads
                </span>
                <span className="flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {formatSize(listing.fileSize)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {listing.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0">
              {isInstalled ? (
                <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/10 text-green-600 text-sm font-medium">
                  <Check className="h-4 w-4" /> Installed
                </span>
              ) : (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {installing ? "Installing..." : "Install"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 pt-3 border-b border-[var(--border)]">
          {(["details", "reviews", "versions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-accent text-accent"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab} {tab === "reviews" && `(${reviews.length})`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-4">
          {activeTab === "details" && (
            <div className="flex gap-6">
              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {listing.description}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Sidebar info */}
              <aside className="w-64 shrink-0 space-y-4">
                <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                  <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Info</h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Version</span>
                      <span className="font-mono">{listing.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">License</span>
                      <span>{listing.license}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Updated</span>
                      <span>{formatDate(listing.updatedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Created</span>
                      <span>{formatDate(listing.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                  <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Compatibility
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {listing.compatibility.platforms.map((p) => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]">
                        {p}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">
                    Requires HugBrowse {listing.compatibility.minAppVersion}+
                  </p>
                </div>

                {/* FR-096: Report button */}
                <button className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-red-500 transition-colors">
                  <Flag className="h-3 w-3" /> Report this extension
                </button>

                {/* Author link */}
                <a
                  href={`https://huggingface.co/${listing.authorName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> View on HuggingFace
                </a>
              </aside>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-4 max-w-2xl">
              {/* FR-094: Write a review */}
              {isInstalled && (
                <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Write a Review</h3>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setUserRating(n)}
                        className="transition-colors"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            n <= userRating ? "text-yellow-500 fill-yellow-500" : "text-[var(--border)]"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your experience..."
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={handleSubmitReview}
                    disabled={userRating === 0}
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                  >
                    Submit Review
                  </button>
                </div>
              )}

              {/* Review list */}
              {reviews.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-8">No reviews yet</p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{review.authorName}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3 w-3 ${n <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-[var(--border)]"}`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-[var(--muted)] ml-auto flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDate(review.createdAt)}
                      </span>
                    </div>
                    {review.text && <p className="text-xs text-[var(--muted)] leading-relaxed">{review.text}</p>}
                    <button className="text-[10px] text-[var(--muted)] hover:text-red-500 flex items-center gap-1">
                      <Flag className="h-2.5 w-2.5" /> Report
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "versions" && (
            <div className="space-y-2 max-w-2xl">
              {listing.versions.map((v) => (
                <div key={v.version} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold font-mono">v{v.version}</span>
                    <span className="text-[10px] text-[var(--muted)]">{formatDate(v.releasedAt)}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">{v.changelog}</p>
                </div>
              ))}
              {listing.versions.length === 0 && (
                <p className="text-sm text-[var(--muted)] text-center py-8">No version history available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
