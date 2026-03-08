import { useLiveResources } from "../hooks/useLiveResources";
import { useAlerts } from "../hooks/useAlerts";
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
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shrink-0">
          <Activity className="h-5 w-5 text-accent dark:text-accent-light" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Resource Monitor</h1>
          <p className="text-xs text-[var(--muted)]">
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
            current?.vram_used_gb != null && current?.vram_total_gb
              ? (current.vram_used_gb / current.vram_total_gb) * 100
              : 0
          }
          used={
            current?.vram_used_gb != null
              ? `${current.vram_used_gb.toFixed(1)} GB`
              : undefined
          }
          total={
            current?.vram_total_gb != null
              ? `${current.vram_total_gb.toFixed(1)} GB`
              : undefined
          }
          color="#f97316"
          unavailable={current?.vram_total_gb == null}
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
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-semibold mb-2">💿 Disk Space</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{
                    width: `${((current.disk_total_gb - current.disk_free_gb) / current.disk_total_gb) * 100}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-sm font-mono text-[var(--muted)]">
              {current.disk_free_gb.toFixed(0)} GB free /{" "}
              {current.disk_total_gb.toFixed(0)} GB
            </span>
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
