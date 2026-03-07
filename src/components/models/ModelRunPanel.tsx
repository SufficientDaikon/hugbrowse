import { useState } from "react";
import { useInference } from "../../stores/inference";
import { useDownloads } from "../../stores/downloads";
import {
  Cpu,
  Play,
  Square,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { DownloadEntry } from "../../stores/downloads";

interface ModelRunPanelProps {
  /** A completed download the user wants to load */
  download?: DownloadEntry;
}

export function ModelRunPanel({ download }: ModelRunPanelProps) {
  const { info, load, unload } = useInference();
  const { downloads } = useDownloads();
  const [port, setPort] = useState(8080);
  const [ctxSize, setCtxSize] = useState(4096);

  const loadableDownloads = Object.values(downloads).filter(
    (d) => d.status === "complete",
  );
  const [selectedPath, setSelectedPath] = useState(
    download?.local_path ?? loadableDownloads[0]?.local_path ?? "",
  );
  const selectedDownload = Object.values(downloads).find(
    (d) => d.local_path === selectedPath,
  );

  const isLoading = info.status === "loading";
  const isRunning = info.status === "running";
  const isError = info.status === "error";

  const handleLoad = async () => {
    if (!selectedPath) return;
    const modelName =
      selectedDownload?.filename ?? selectedPath.split("/").pop() ?? "model";
    await load({ modelPath: selectedPath, modelName, port, ctxSize });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
        <Cpu className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Inference Engine</h3>
        <div className="ml-auto flex items-center gap-1.5">
          {info.status === "unloaded" && (
            <span className="text-xs text-[var(--muted)]">No model loaded</span>
          )}
          {isLoading && (
            <span className="flex items-center gap-1 text-xs text-yellow-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle className="h-3.5 w-3.5" /> Running
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <XCircle className="h-3.5 w-3.5" /> Error
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isRunning ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                {info.model_name}
              </p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Port {info.port} · {info.ctx_size.toLocaleString()} ctx tokens
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-mono">
                http://127.0.0.1:{info.port}/v1
              </p>
            </div>
            <button
              onClick={unload}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Square className="h-4 w-4" /> Unload Model
            </button>
          </div>
        ) : (
          <>
            {loadableDownloads.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-2">
                No models downloaded yet. Download a GGUF file first.
              </p>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] mb-1 block">
                    Model
                  </label>
                  <select
                    value={selectedPath}
                    onChange={(e) => setSelectedPath(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    {loadableDownloads.map((d) => (
                      <option key={d.id} value={d.local_path}>
                        {d.filename}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] mb-1 block">
                      Port
                    </label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      min={1024}
                      max={65535}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] mb-1 block">
                      Context (tokens)
                    </label>
                    <select
                      value={ctxSize}
                      onChange={(e) => setCtxSize(Number(e.target.value))}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    >
                      {[2048, 4096, 8192, 16384, 32768].map((n) => (
                        <option key={n} value={n}>
                          {(n / 1024).toFixed(0)}K
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isError && info.error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {info.error}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleLoad}
                  disabled={isLoading || !selectedPath}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-hf-orange px-4 py-2 text-sm font-medium text-white hover:bg-hf-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      Model…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Load Model
                    </>
                  )}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
