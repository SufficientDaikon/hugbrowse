/** FR-061: Crash reporter dialog */
import { useState } from "react";
import { AlertTriangle, Send, X, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  error: Error;
  componentStack?: string;
  onDismiss: () => void;
}

export function CrashReporter({ error, componentStack, onDismiss }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // FR-061: Collect anonymous system info for crash report
  const reportData = {
    error: error.message,
    stack: error.stack?.slice(0, 2000),
    componentStack: componentStack?.slice(0, 1000),
    timestamp: new Date().toISOString(),
    appVersion: "0.1.0",
    platform: navigator.platform,
    userAgent: navigator.userAgent.slice(0, 200),
  };

  const handleSend = async () => {
    setSending(true);
    // NFR-022: Only send if user consented (check localStorage)
    const consent = localStorage.getItem("hugbrowse-crash-consent");
    if (consent !== "true") {
      setSending(false);
      return;
    }
    try {
      // Would POST to crash reporting endpoint
      console.log("Crash report (would send):", reportData);
      setSent(true);
    } catch {
      // Silently fail — crash reporter should never crash
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="max-w-lg w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--border)] bg-red-500/5">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Something went wrong</h2>
            <p className="text-xs text-[var(--muted)]">HugBrowse encountered an unexpected error</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-red-500 font-mono bg-red-500/5 rounded-lg p-2">
            {error.message}
          </p>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDetails ? "Hide" : "Show"} technical details
          </button>

          {showDetails && (
            <pre className="text-[10px] font-mono text-[var(--muted)] bg-[var(--background)] rounded-lg p-2 max-h-40 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(reportData, null, 2)}
            </pre>
          )}

          <div className="flex gap-2 pt-2">
            {!sent ? (
              <>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  {sending ? "Sending..." : "Send Anonymous Report"}
                </button>
                <button
                  onClick={onDismiss}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Dismiss
                </button>
              </>
            ) : (
              <p className="text-xs text-green-600">✓ Report sent. Thank you!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
