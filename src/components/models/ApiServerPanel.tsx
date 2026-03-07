import { useInference } from "../../stores/inference";
import { Server, Copy, Check } from "lucide-react";
import { useState } from "react";

export function ApiServerPanel() {
  const { info } = useInference();
  const [copied, setCopied] = useState(false);
  const baseUrl = `http://127.0.0.1:${info.port}/v1`;

  const copy = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Server className="h-4 w-4" />
        Local API Server
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
            info.status === "running"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-[var(--border)] text-[var(--muted)]"
          }`}
        >
          {info.status === "running" ? "Online" : "Offline"}
        </span>
      </h4>

      {info.status === "running" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
            <code className="flex-1 text-xs font-mono text-accent truncate">
              {baseUrl}
            </code>
            <button
              onClick={copy}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Copy URL"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="space-y-1 text-xs text-[var(--muted)]">
            <p>✓ POST {baseUrl}/chat/completions</p>
            <p>✓ GET {baseUrl}/models</p>
            <p>✓ POST {baseUrl}/embeddings</p>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Drop-in replacement for the OpenAI API. Point any client here.
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Load a model to start the local API server.
        </p>
      )}
    </div>
  );
}
