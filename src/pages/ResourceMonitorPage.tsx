import { useLiveResources } from "../hooks/useLiveResources";
import { useAlerts } from "../hooks/useAlerts";
import { useSystemInfo } from "../hooks/useSystemInfo";
import { ResourceGauge } from "../components/monitor/ResourceGauge";
import { ResourceHistory } from "../components/monitor/ResourceHistory";
import { HeadroomCard } from "../components/monitor/HeadroomCard";
import { AlertToast } from "../components/monitor/AlertToast";
import { TierClassifier } from "../components/tier/TierClassifier";
import { useState } from "react";
import { Activity } from "lucide-react";

export function ResourceMonitorPage() {
  const { current, history } = useLiveResources(true, 2000);
  const { alerts, dismiss } = useAlerts(current);
  const { data: sysInfo } = useSystemInfo();
  const [showHistory, setShowHistory] = useState(false);

  // VRAM total: prefer live data, fall back to static system info
  const vramTotalGb = current?.vram_total_gb ?? sysInfo?.gpu_vram_gb ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 shrink-0">
          <Activity className="h-4 w-4 text-accent dark:text-accent-light" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">Resource Monitor</h1>
          <p className="text-[11px] text-[var(--muted)]">
            Real-time system tracking · Updates every 2s
          </p>
        </div>
      </div>

      {/* Tier Info */}
      <TierClassifier />

      {/* Live Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ResourceGauge
          label="CPU"
          icon="⚡"
          value={current?.cpu_percent ?? 0}
          used={current ? `${current.cpu_percent.toFixed(0)}%` : "–"}
          total={current ? `${current.cpu_per_core.length} cores` : "–"}
          color="#6366f1"
        />
        <ResourceGauge
          label="RAM"
          icon="🧠"
          value={
            current ? (current.ram_used_gb / current.ram_total_gb) * 100 : 0
          }
          used={current ? `${current.ram_used_gb.toFixed(1)} GB` : "–"}
          total={current ? `${current.ram_total_gb.toFixed(1)} GB` : "–"}
          color="#22c55e"
        />
        <ResourceGauge
          label="GPU"
          icon="🎮"
          value={current?.gpu_percent ?? 0}
          used={
            current?.gpu_percent != null
              ? `${current.gpu_percent.toFixed(0)}%`
              : undefined
          }
          total={
            current?.gpu_temp_c != null ? `${current.gpu_temp_c}°C` : undefined
          }
          color="#a855f7"
          unavailable={current?.gpu_percent == null}
          unavailableText="No discrete GPU detected"
        />
        <ResourceGauge
          label="VRAM"
          icon="💾"
          value={
            current?.vram_used_gb != null && vramTotalGb
              ? (current.vram_used_gb / vramTotalGb) * 100
              : 0
          }
          used={
            current?.vram_used_gb != null
              ? `${current.vram_used_gb.toFixed(1)} GB`
              : undefined
          }
          total={
            vramTotalGb != null
              ? `${vramTotalGb.toFixed(1)} GB`
              : undefined
          }
          color="#f97316"
          unavailable={vramTotalGb == null}
          unavailableText="N/A (shared with RAM)"
        />
      </div>

      {/* Headroom */}
      {current && <HeadroomCard resources={current} />}

      {/* History toggle */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm font-medium text-accent dark:text-accent-light hover:underline"
        >
          {showHistory ? "Hide History ▲" : "Show Usage History ▼"} (
          {history.length} samples)
        </button>
      </div>

      {/* History chart */}
      {showHistory && history.length > 1 && (
        <ResourceHistory history={history} height={250} />
      )}

      {/* Disk */}
      {current && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm">💿</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Disk Space</span>
                <span className="text-[11px] font-mono text-[var(--muted)] tabular-nums">
                  {current.disk_free_gb.toFixed(0)} GB free /{" "}
                  {current.disk_total_gb.toFixed(0)} GB
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{
                    width: `${((current.disk_total_gb - current.disk_free_gb) / current.disk_total_gb) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.map((alert) => (
        <AlertToast key={alert.type} alert={alert} onDismiss={dismiss} />
      ))}
    </div>
  );
}
