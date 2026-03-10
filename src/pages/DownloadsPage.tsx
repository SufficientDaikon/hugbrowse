import { useEffect } from "react";
import { useDownloads } from "../stores/downloads";
import { DownloadItem } from "../components/download/DownloadItem";
import {
  Download,
  Inbox,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function DownloadsPage() {
  const { downloads, init, remove } = useDownloads();

  useEffect(() => {
    init();
  }, [init]);

  const entries = Object.values(downloads).sort((a, b) => {
    const order: Record<string, number> = {
      downloading: 0,
      paused: 1,
      validating: 2,
      queued: 3,
      complete: 4,
      failed: 5,
      cancelled: 6,
    };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  const activeEntries = entries.filter(
    (e) => e.status === "downloading" || e.status === "paused" || e.status === "queued" || e.status === "validating",
  );
  const completedEntries = entries.filter((e) => e.status === "complete");
  const failedEntries = entries.filter((e) => e.status === "failed" || e.status === "cancelled");

  const totalDownloaded = completedEntries.reduce((sum, e) => sum + e.total_bytes, 0);
  const activeSpeed = activeEntries.reduce((sum, e) => sum + (e.speed_bps || 0), 0);

  const clearCompleted = () => {
    completedEntries.forEach((e) => remove(e.id, false));
  };

  const clearFailed = () => {
    failedEntries.forEach((e) => remove(e.id, true));
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-hf-orange/20 to-orange-500/20">
              <Download className="h-5 w-5 text-hf-orange" />
            </div>
            Download Manager
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {entries.length} download{entries.length !== 1 ? "s" : ""}
            {activeSpeed > 0 && ` • ${formatBytes(activeSpeed)}/s`}
            {totalDownloaded > 0 && ` • ${formatBytes(totalDownloaded)} total`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-2xl font-bold text-hf-orange">{activeEntries.length}</div>
          <div className="text-xs text-[var(--muted)] mt-1">Active</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-2xl font-bold text-green-500">{completedEntries.length}</div>
          <div className="text-xs text-[var(--muted)] mt-1">Completed</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-2xl font-bold text-red-500">{failedEntries.length}</div>
          <div className="text-xs text-[var(--muted)] mt-1">Failed</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-2xl font-bold text-[var(--foreground)]">{formatBytes(totalDownloaded)}</div>
          <div className="text-xs text-[var(--muted)] mt-1">Total Downloaded</div>
        </div>
      </div>

      {/* Active Downloads */}
      {activeEntries.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-hf-orange" />
            Active Downloads ({activeEntries.length})
          </h2>
          <div className="space-y-2">
            {activeEntries.map((entry) => (
              <DownloadItem key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Completed Downloads */}
      {completedEntries.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Completed ({completedEntries.length})
            </h2>
            <button
              onClick={clearCompleted}
              className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear all
            </button>
          </div>
          <div className="space-y-2">
            {completedEntries.map((entry) => (
              <DownloadItem key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Failed Downloads */}
      {failedEntries.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Failed ({failedEntries.length})
            </h2>
            <button
              onClick={clearFailed}
              className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear all
            </button>
          </div>
          <div className="space-y-2">
            {failedEntries.map((entry) => (
              <DownloadItem key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--surface-hover)] mb-4">
            <Inbox className="h-10 w-10 opacity-40" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">No downloads yet</h2>
          <p className="text-sm">
            Browse models and click a GGUF file to start downloading
          </p>
        </div>
      )}
    </div>
  );
}
