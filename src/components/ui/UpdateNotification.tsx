/**
 * FR-047: Non-blocking update notification on launch.
 * FR-048: Background download + prompt before apply.
 */
import { useEffect, useState } from "react";
import { X, Download, RefreshCw } from "lucide-react";

interface UpdateInfo {
  version: string;
  body?: string;
}

export function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const result = await check();
      if (result?.available) {
        setUpdate({
          version: result.version,
          body: result.body ?? undefined,
        });
      }
    } catch {
      // Updater not available (dev mode or no config)
    }
  }

  async function downloadAndInstall() {
    setDownloading(true);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const result = await check();
      if (!result?.available) return;

      let totalBytes = 0;
      let downloadedBytes = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await result.downloadAndInstall((event: any) => {
        if (event.event === "Started" && event.data?.contentLength) {
          totalBytes = event.data.contentLength;
        }
        if (event.event === "Progress" && event.data?.chunkLength) {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            setProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        }
        if (event.event === "Finished") {
          setProgress(100);
        }
      });

      // FR-048: Update applied on next launch
      setUpdate(null);
    } catch {
      // EC-018: Download failed — clean up silently
      setDownloading(false);
      setProgress(0);
    }
  }

  if (!update || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-accent shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Update Available
            </p>
            <p className="text-xs text-[var(--muted)]">
              Version {update.version} is ready
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {update.body && (
        <p className="mt-2 text-xs text-[var(--muted)] line-clamp-3">
          {update.body}
        </p>
      )}

      {downloading ? (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[var(--muted)] text-right">
            {progress}%
          </p>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button
            onClick={downloadAndInstall}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors"
          >
            <Download className="h-3 w-3" /> Download & Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
