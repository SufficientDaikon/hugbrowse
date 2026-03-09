import { useEffect, useState } from "react";
import { useApiServer, type RequestLogEntry } from "../stores/apiServer";
import { TokenManager } from "../components/developer/TokenManager";
import { cn } from "../components/ui/cn";
import {
  Play,
  Square,
  Server,
  Activity,
  Clock,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";

export function DeveloperPage() {
  const {
    running,
    port,
    host,
    config,
    requestLog,
    startServer,
    stopServer,
    refreshStatus,
    updateConfig,
    initListeners,
  } = useApiServer();

  const [portInput, setPortInput] = useState(String(port));
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    refreshStatus();
    const unlisten = initListeners();
    return unlisten;
  }, [refreshStatus, initListeners]);

  useEffect(() => {
    setPortInput(String(port));
  }, [port]);

  const handleStart = async () => {
    setError(null);
    setStarting(true);
    try {
      const newPort = parseInt(portInput, 10);
      if (newPort !== config.port) {
        await updateConfig({ ...config, port: newPort });
      }
      await startServer();
    } catch (e) {
      setError(String(e));
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setError(null);
    setStopping(true);
    try {
      await stopServer();
    } catch (e) {
      setError(String(e));
    } finally {
      setStopping(false);
    }
  };

  const copyBaseUrl = () => {
    navigator.clipboard.writeText(`http://${host}:${port}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Developer
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          API Server &amp; developer tools for integrating HugBrowse with
          external applications.
        </p>
      </div>

      {/* Server Controls */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-[var(--muted)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              API Server
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                running
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-gray-500/10 text-gray-500 dark:text-gray-400"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  running ? "bg-green-500" : "bg-gray-400"
                )}
              />
              {running ? "Running" : "Stopped"}
            </span>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Port
            </label>
            <input
              type="number"
              min={1024}
              max={65535}
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              disabled={running}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-50"
            />
          </div>
          <button
            onClick={running ? handleStop : handleStart}
            disabled={starting || stopping}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              running
                ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                : "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400",
              (starting || stopping) && "opacity-50 cursor-not-allowed"
            )}
          >
            {running ? (
              <>
                <Square className="h-4 w-4" />
                {stopping ? "Stopping…" : "Stop"}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {starting ? "Starting…" : "Start"}
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}

        {running && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--background)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">Base URL:</span>
            <code className="font-mono text-[var(--foreground)]">
              http://{host}:{port}
            </code>
            <button
              onClick={copyBaseUrl}
              className="ml-auto text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Copy URL"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}

        {running && (
          <div className="text-xs text-[var(--muted)] space-y-1">
            <p>
              <strong>OpenAI-compatible:</strong>{" "}
              <code>GET /v1/models</code>,{" "}
              <code>POST /v1/chat/completions</code>,{" "}
              <code>POST /v1/completions</code>,{" "}
              <code>POST /v1/embeddings</code>
            </p>
            <p>
              <strong>Native API:</strong> <code>GET /api/v1/status</code>,{" "}
              <code>POST /api/v1/models/load</code>,{" "}
              <code>POST /api/v1/models/unload</code>,{" "}
              <code>POST /api/v1/chat</code>
            </p>
          </div>
        )}
      </section>

      {/* Authentication */}
      <TokenManager />

      {/* Request Log */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-3">
        <button
          onClick={() => setLogOpen(!logOpen)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-[var(--muted)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Request Log
            </h2>
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">
              {requestLog.length}
            </span>
          </div>
          {logOpen ? (
            <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
          )}
        </button>

        {logOpen && (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
            {(requestLog ?? []).length === 0 ? (
              <p className="p-4 text-center text-sm text-[var(--muted)]">
                No requests yet.{" "}
                {!running && "Start the server to begin logging."}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border-subtle)]">
                  <tr className="text-left text-[var(--muted)]">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Path</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {[...(requestLog ?? [])]
                    .reverse()
                    .map((entry) => (
                      <RequestRow key={entry.id} entry={entry} />
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function RequestRow({ entry }: { entry: RequestLogEntry }) {
  const time = new Date(entry.timestamp * 1000).toLocaleTimeString();
  const statusColor =
    entry.status < 300
      ? "text-green-600 dark:text-green-400"
      : entry.status < 400
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <tr className="text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors">
      <td className="px-3 py-1.5 font-mono text-[var(--muted)]">
        <Clock className="inline h-3 w-3 mr-1 opacity-50" />
        {time}
      </td>
      <td className="px-3 py-1.5">
        <span className="rounded bg-[var(--background)] px-1.5 py-0.5 font-mono font-medium">
          {entry.method}
        </span>
      </td>
      <td className="px-3 py-1.5 font-mono">{entry.path}</td>
      <td className={cn("px-3 py-1.5 font-mono font-medium", statusColor)}>
        {entry.status}
      </td>
      <td className="px-3 py-1.5 text-[var(--muted)]">{entry.durationMs}ms</td>
      <td className="px-3 py-1.5 text-[var(--muted)] truncate max-w-[120px]">
        {entry.model ?? "—"}
      </td>
    </tr>
  );
}
