import {
  useDownloads,
  type DownloadEntry,
  type DownloadStatus,
} from "../../stores/downloads";
import {
  Pause,
  Play,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "../ui/cn";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function formatEta(secs: number) {
  if (!secs || !isFinite(secs)) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  return `${(secs / 3600).toFixed(1)}h`;
}

const statusIcon: Record<DownloadStatus, React.ReactNode> = {
  queued: <Loader2 className="h-4 w-4 animate-spin text-[var(--muted)]" />,
  downloading: <Loader2 className="h-4 w-4 animate-spin text-hf-orange" />,
  paused: <Pause className="h-4 w-4 text-yellow-500" />,
  validating: <Loader2 className="h-4 w-4 animate-spin text-accent" />,
  complete: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />,
  cancelled: <X className="h-4 w-4 text-[var(--muted)]" />,
};

interface DownloadItemProps {
  entry: DownloadEntry;
}

export function DownloadItem({ entry }: DownloadItemProps) {
  const { pause, resume, cancel, remove } = useDownloads();
  const pct =
    entry.total_bytes > 0
      ? Math.min(100, (entry.downloaded_bytes / entry.total_bytes) * 100)
      : 0;
  const active = entry.status === "downloading" || entry.status === "paused";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon[entry.status]}
          <span className="text-sm font-medium truncate" title={entry.filename}>
            {entry.filename}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entry.status === "downloading" && (
            <button
              onClick={() => pause(entry.id)}
              className="rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              title="Pause"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          )}
          {entry.status === "paused" && (
            <button
              onClick={() => resume(entry.id)}
              className="rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              title="Resume"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {active && (
            <button
              onClick={() => cancel(entry.id)}
              className="rounded p-1 text-[var(--muted)] hover:text-red-500 hover:bg-[var(--surface-hover)] transition-colors"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {(entry.status === "complete" ||
            entry.status === "failed" ||
            entry.status === "cancelled") && (
            <button
              onClick={() => remove(entry.id, entry.status === "failed")}
              className="rounded p-1 text-[var(--muted)] hover:text-red-500 hover:bg-[var(--surface-hover)] transition-colors"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(entry.status === "downloading" ||
        entry.status === "paused" ||
        entry.status === "validating") && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                entry.status === "paused" ? "bg-yellow-400" : "bg-hf-orange",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--muted)]">
            <span>
              {formatBytes(entry.downloaded_bytes)} /{" "}
              {formatBytes(entry.total_bytes)}
              {entry.speed_bps > 0 && ` • ${formatBytes(entry.speed_bps)}/s`}
            </span>
            <span>
              {pct.toFixed(0)}%
              {entry.eta_secs > 0 && ` • ${formatEta(entry.eta_secs)} left`}
            </span>
          </div>
        </div>
      )}

      {entry.status === "complete" && (
        <p className="text-xs text-green-600 dark:text-green-400">
          ✓ {formatBytes(entry.total_bytes)} — ready to load
        </p>
      )}
      {entry.status === "failed" && (
        <p className="text-xs text-red-500 truncate" title={entry.error}>
          {entry.error ?? "Download failed"}
        </p>
      )}
    </div>
  );
}
