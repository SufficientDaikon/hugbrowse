import { useState, useEffect } from "react";
import { useSettings } from "../stores/settings";
import { hfApi } from "../lib/hf-api";
import { useMCP } from "../hooks/useMCP";
import { useTier } from "../hooks/useTier";
import { cn } from "../components/ui/cn";
import { TIER_INFO, DEFAULT_ALERT_THRESHOLDS } from "../lib/constants";
import type { HardwareTier } from "../lib/hf-types";
import {
  Check,
  X,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Key,
  Plug,
  RefreshCw,
  Cpu,
  Bell,
} from "lucide-react";

export function SettingsPage() {
  const {
    theme,
    setTheme,
    hfToken,
    hfUsername,
    setHfToken,
    searchHistory,
    clearSearchHistory,
    tierOverride,
    setTierOverride,
    alertThresholds,
    setAlertThresholds,
    autoLoadLastModel,
    setAutoLoadLastModel,
    lastModelPath,
  } = useSettings();
  const mcp = useMCP();
  const { data: tierInfo } = useTier();
  const [tokenInput, setTokenInput] = useState(hfToken || "");
  const [validating, setValidating] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<"idle" | "valid" | "invalid">(
    "idle",
  );

  useEffect(() => {
    if (hfToken) {
      setTokenInput(hfToken);
      setTokenStatus("valid");
    }
  }, [hfToken]);

  const validateToken = async () => {
    if (!tokenInput.trim()) {
      setHfToken(null);
      setTokenStatus("idle");
      hfApi.setToken(null);
      return;
    }

    setValidating(true);
    hfApi.setToken(tokenInput.trim());
    const user = await hfApi.validateToken();
    setValidating(false);

    if (user) {
      setHfToken(tokenInput.trim(), user.name);
      setTokenStatus("valid");
    } else {
      setTokenStatus("invalid");
      hfApi.setToken(hfToken);
    }
  };

  const removeToken = () => {
    setTokenInput("");
    setHfToken(null);
    setTokenStatus("idle");
    hfApi.setToken(null);
  };

  const themes = [
    { value: "system" as const, label: "System", icon: Monitor },
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-[var(--foreground)] mb-6">
        Settings
      </h1>

      {/* HuggingFace Token */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-hf-orange" />
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            HuggingFace API Token
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">
          Add your token to access gated models, private repos, and get higher
          rate limits. Get one at{" "}
          <a
            href="https://huggingface.co/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            huggingface.co/settings/tokens
          </a>
        </p>

        <div className="flex gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value);
              setTokenStatus("idle");
            }}
            placeholder="hf_xxxxxxxxxxxxxxxxxxxxx"
            className={cn(
              "flex-1 rounded-lg border bg-[var(--background)] px-3 py-2 text-sm font-mono",
              "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
              tokenStatus === "valid"
                ? "border-can-run"
                : tokenStatus === "invalid"
                  ? "border-cant-run"
                  : "border-[var(--border)]",
            )}
          />
          <button
            onClick={validateToken}
            disabled={validating}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Validate"
            )}
          </button>
        </div>

        {/* Token Status */}
        {tokenStatus === "valid" && (
          <div className="flex items-center justify-between mt-3 rounded-lg bg-can-run/10 p-3">
            <span className="flex items-center gap-2 text-sm text-can-run dark:text-can-run-light">
              <Check className="h-4 w-4" />
              Connected as <strong>{hfUsername}</strong>
            </span>
            <button
              onClick={removeToken}
              className="text-xs text-[var(--muted)] hover:text-cant-run transition-colors"
            >
              Remove
            </button>
          </div>
        )}
        {tokenStatus === "invalid" && (
          <div className="flex items-center gap-2 mt-3 rounded-lg bg-cant-run/10 p-3 text-sm text-cant-run dark:text-cant-run-light">
            <X className="h-4 w-4" />
            Invalid token. Please check and try again.
          </div>
        )}
      </section>

      {/* Theme */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6">
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">
          Theme
        </h2>
        <div className="flex gap-2">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all",
                theme === t.value
                  ? "border-accent bg-accent/10 text-accent dark:text-accent-light font-medium"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Search History */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Search History
          </h2>
          {searchHistory.length > 0 && (
            <button
              onClick={clearSearchHistory}
              className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-cant-run transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        {searchHistory.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((q, i) => (
              <span
                key={i}
                className="rounded-full bg-[var(--background)] px-3 py-1 text-xs text-[var(--muted)]"
              >
                {q}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No search history yet.</p>
        )}
      </section>

      {/* MCP Server Status */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plug className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            MCP Server
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">
          HuggingFace MCP server provides enriched model data. Requires an API
          token.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                mcp.status === "connected" &&
                  "bg-can-run dark:bg-can-run-light",
                mcp.status === "connecting" && "bg-maybe-run animate-pulse",
                mcp.status === "error" && "bg-cant-run dark:bg-cant-run-light",
                mcp.status === "disconnected" && "bg-[var(--muted-foreground)]",
              )}
            />
            <span className="text-sm text-[var(--foreground)] capitalize">
              {mcp.status}
            </span>
          </div>
          {mcp.isConnected && (
            <span className="text-xs text-[var(--muted)]">
              {mcp.tools.length} tools available
            </span>
          )}
          {(mcp.status === "error" || mcp.status === "disconnected") &&
            hfToken && (
              <button
                onClick={mcp.reconnect}
                className="flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> Reconnect
              </button>
            )}
          {!hfToken && (
            <span className="text-xs text-[var(--muted)]">
              Add a token above to connect
            </span>
          )}
        </div>
        {mcp.isConnected && mcp.tools.length > 0 && (
          <div className="mt-3 rounded-lg bg-[var(--background)] p-3">
            <p className="text-xs font-medium text-[var(--muted)] mb-2">
              Available Tools:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {mcp.tools.map((tool) => (
                <span
                  key={tool.name}
                  className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-xs font-mono text-[var(--foreground)] border border-[var(--border)]"
                >
                  {tool.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Hardware Tier Override */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-5 w-5 text-purple-500" />
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Hardware Tier
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">
          Your detected tier: <strong>{tierInfo?.icon} {tierInfo?.name ?? "Detecting..."}</strong>.
          Override if auto-detection is wrong.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTierOverride(null)}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs transition-all",
              !tierOverride
                ? "border-accent bg-accent/10 text-accent dark:text-accent-light font-medium"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)]",
            )}
          >
            🔍 Auto-detect
          </button>
          {(Object.entries(TIER_INFO) as [HardwareTier, typeof TIER_INFO[HardwareTier]][]).map(([tier, info]) => (
            <button
              key={tier}
              onClick={() => setTierOverride(tier)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs transition-all",
                tierOverride === tier
                  ? "border-accent bg-accent/10 text-accent dark:text-accent-light font-medium"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)]",
              )}
            >
              {info.icon} {info.name}
            </button>
          ))}
        </div>
      </section>

      {/* FR-032: Auto-load Last Model */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Inference
          </h2>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoLoadLastModel}
            onChange={(e) => setAutoLoadLastModel(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] accent-accent"
          />
          <span className="text-sm text-[var(--foreground)]">
            Auto-load last used model on app start
          </span>
        </label>
        {lastModelPath && (
          <p className="mt-2 text-xs text-[var(--muted)] truncate">
            Last model: {lastModelPath}
          </p>
        )}
      </section>

      {/* Alert Thresholds */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-yellow-500" />
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Resource Alerts
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">
          Get notified when resource usage exceeds these thresholds.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { key: "cpu" as const, label: "CPU %", icon: "⚡" },
            { key: "ram" as const, label: "RAM %", icon: "🧠" },
            { key: "vram" as const, label: "VRAM %", icon: "💾" },
          ]).map(({ key, label, icon }) => (
            <div key={key} className="rounded-lg bg-[var(--background)] p-3">
              <label className="text-xs text-[var(--muted)] flex items-center gap-1 mb-2">
                <span>{icon}</span> {label} threshold
              </label>
              <input
                type="range"
                min={50}
                max={99}
                value={alertThresholds[key]}
                onChange={(e) =>
                  setAlertThresholds({ ...alertThresholds, [key]: Number(e.target.value) })
                }
                className="w-full accent-accent"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-[var(--muted)]">50%</span>
                <span className="text-sm font-mono font-medium">{alertThresholds[key]}%</span>
                <span className="text-xs text-[var(--muted)]">99%</span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setAlertThresholds(DEFAULT_ALERT_THRESHOLDS)}
          className="mt-3 text-xs text-accent dark:text-accent-light hover:underline"
        >
          Reset to defaults
        </button>
      </section>

      {/* About */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">
          About
        </h2>
        <p className="text-sm text-[var(--muted)]">
          <strong>HugBrowse</strong> v0.1.0 — A beautiful Hugging Face model
          browser.
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-2">
          Built with Tauri, React, and Tailwind CSS.
        </p>
      </section>
    </div>
  );
}
