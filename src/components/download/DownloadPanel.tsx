import { useEffect } from "react";
import { useDownloads } from "../../stores/downloads";
import { DownloadItem } from "./DownloadItem";
import { Download, Inbox } from "lucide-react";

export function DownloadPanel() {
  const { downloads, init } = useDownloads();

  useEffect(() => {
    init();
  }, [init]);

  const entries = Object.values(downloads).sort((a, b) => {
    // Active first, then complete, then failed/cancelled
    const order = {
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

  const activeCount = entries.filter(
    (e) =>
      e.status === "downloading" ||
      e.status === "paused" ||
      e.status === "validating",
  ).length;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" />
          Downloads
          {activeCount > 0 && (
            <span className="rounded-full bg-hf-orange text-white text-xs px-1.5 py-0.5">
              {activeCount}
            </span>
          )}
        </h3>
      </div>

      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--muted)]">
            <Inbox className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No downloads yet</p>
            <p className="text-xs mt-1 opacity-60">
              Click a GGUF file to start downloading
            </p>
          </div>
        ) : (
          entries.map((entry) => <DownloadItem key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
