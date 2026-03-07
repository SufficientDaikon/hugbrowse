/** FR-097: Creator Dashboard */
import { useState } from "react";
import { useMarketplace } from "../../stores/marketplace";
import { BarChart3, TrendingUp, Star, Package, Eye } from "lucide-react";
import { PublishWizard } from "../../components/marketplace/PublishWizard";

export function CreatorDashboard() {
  const { installed, listings } = useMarketplace();
  const [showPublish, setShowPublish] = useState(false);

  // FR-097: Show creator's published content, download stats, ratings
  const myListings = listings.filter((l) => l.authorId === "local-user");
  const totalDownloads = myListings.reduce((sum, l) => sum + l.downloadCount, 0);
  const avgRating = myListings.length > 0
    ? myListings.reduce((sum, l) => sum + l.averageRating, 0) / myListings.length
    : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" /> Creator Dashboard
            </h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              Manage your published content and track performance
            </p>
          </div>
          <button
            onClick={() => setShowPublish(true)}
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            + Publish New
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        {[
          { label: "Published", value: myListings.length, icon: Package, color: "text-blue-500" },
          { label: "Downloads", value: totalDownloads.toLocaleString(), icon: TrendingUp, color: "text-green-500" },
          { label: "Avg Rating", value: avgRating.toFixed(1), icon: Star, color: "text-yellow-500" },
          { label: "Installed by Others", value: installed.length, icon: Eye, color: "text-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-[var(--muted)]">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Published listings */}
      <div className="flex-1 overflow-y-auto px-6">
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Your Publications ({myListings.length})
        </h2>
        {myListings.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-10 w-10 text-[var(--border)] mx-auto mb-3" />
            <p className="text-sm text-[var(--muted)]">You haven't published anything yet</p>
            <button
              onClick={() => setShowPublish(true)}
              className="mt-3 text-xs text-accent hover:underline"
            >
              Publish your first extension
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {myListings.map((listing) => (
              <div key={listing.id} className="flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">{listing.name}</h3>
                  <p className="text-[10px] text-[var(--muted)]">
                    v{listing.version} · {listing.downloadCount} downloads · {listing.averageRating.toFixed(1)} ★
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  listing.status === "published" ? "bg-green-500/10 text-green-600" :
                  listing.status === "flagged" ? "bg-red-500/10 text-red-600" :
                  "bg-gray-500/10 text-gray-600"
                }`}>
                  {listing.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <PublishWizard isOpen={showPublish} onClose={() => setShowPublish(false)} />
    </div>
  );
}
