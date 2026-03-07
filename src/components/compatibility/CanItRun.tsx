import { useState } from "react";
import type { HFModel } from "../../lib/hf-types";
import { useSystemInfo } from "../../hooks/useSystemInfo";
import { useTier } from "../../hooks/useTier";
import {
  estimateModelParams,
  detectQuantization,
} from "../../lib/compatibility";
import { Badge } from "../ui/Badge";
import { cn } from "../ui/cn";
import {
  Cpu,
  HardDrive,
  Monitor,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { QUANTIZATION_TYPES } from "../../lib/constants";
import { QuantComparison } from "./QuantComparison";
import { SpaceCheck } from "../download/SpaceCheck";

interface CanItRunProps {
  model: HFModel;
}

export function CanItRun({ model }: CanItRunProps) {
  const { data: sysInfo } = useSystemInfo();
  const { data: tierInfo } = useTier();
  const [expanded, setExpanded] = useState(false);
  const [showQuantTable, setShowQuantTable] = useState(false);
  const [selectedQuant, setSelectedQuant] = useState<string | null>(null);

  const params = estimateModelParams(model);
  const defaultQuant = detectQuantization(model);
  const quant = selectedQuant || defaultQuant;

  if (!sysInfo || !params) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h3 className="text-sm font-semibold mb-2">
          🖥️ Can it run on your PC?
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {!params
            ? "Unable to determine model size."
            : "Loading system info..."}
        </p>
      </div>
    );
  }

  const bytesPerParam =
    QUANTIZATION_TYPES.find((q) => q.id === quant)?.bytesPerParam ?? 2;
  const modelSizeGb = params * bytesPerParam;
  const neededGb = modelSizeGb * 1.2;

  const gpuCanRun = sysInfo.gpu_vram_gb
    ? sysInfo.gpu_vram_gb >= neededGb
    : false;
  const cpuCanRun = sysInfo.ram_available_gb >= neededGb * 1.1;

  const status = gpuCanRun ? "green" : cpuCanRun ? "yellow" : "red";

  const statusConfig = {
    green: {
      icon: "✓",
      title: "This model can run on your GPU!",
      detail: `Needs ~${neededGb.toFixed(1)}GB • You have ${sysInfo.gpu_vram_gb?.toFixed(1)}GB VRAM`,
      badge: "green" as const,
      border: "border-can-run/30 dark:border-can-run-light/30",
      bg: "bg-can-run/5 dark:bg-can-run-light/5",
    },
    yellow: {
      icon: "⚠",
      title: "Can run on CPU (slower)",
      detail: `Needs ~${neededGb.toFixed(1)}GB • You have ${sysInfo.ram_available_gb.toFixed(1)}GB RAM available`,
      badge: "yellow" as const,
      border: "border-maybe-run/30 dark:border-maybe-run-light/30",
      bg: "bg-maybe-run/5 dark:bg-maybe-run-light/5",
    },
    red: {
      icon: "✗",
      title: "Too large for your system",
      detail: `Needs ~${neededGb.toFixed(1)}GB • You have ${sysInfo.ram_available_gb.toFixed(1)}GB RAM${sysInfo.gpu_vram_gb ? ` + ${sysInfo.gpu_vram_gb.toFixed(1)}GB VRAM` : ""}`,
      badge: "red" as const,
      border: "border-cant-run/30 dark:border-cant-run-light/30",
      bg: "bg-cant-run/5 dark:bg-cant-run-light/5",
    },
  };

  const cfg = statusConfig[status];

  // Generate suggestions
  const suggestions: string[] = [];
  if (status === "red" || status === "yellow") {
    if (quant !== "q4_k_m" && quant !== "q4_0") {
      const q4Size = params * 0.5 * 1.2;
      suggestions.push(
        `Try Q4_K_M quantization (needs only ~${q4Size.toFixed(1)}GB)`,
      );
    }
    if (params > 7) {
      suggestions.push("Consider a smaller model variant (7B or 3B)");
    }
    if (status === "yellow") {
      suggestions.push("GPU offloading could speed this up");
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-6 transition-all",
        cfg.border,
        cfg.bg,
      )}
    >
      {/* Main Result */}
      <div className="flex items-center gap-3 mb-3">
        <div className="text-2xl">{cfg.icon}</div>
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">
            {cfg.title}
          </h3>
          <p className="text-sm text-[var(--muted)]">{cfg.detail}</p>
        </div>
        <Badge variant={cfg.badge} className="ml-auto text-sm px-3 py-1">
          {status === "green"
            ? "Compatible"
            : status === "yellow"
              ? "Possible"
              : "Too Large"}
        </Badge>
      </div>

      {/* Quantization Selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-[var(--muted)]">Quantization:</span>
        {QUANTIZATION_TYPES.map((q) => (
          <button
            key={q.id}
            onClick={() => setSelectedQuant(q.id)}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs transition-colors",
              quant === q.id
                ? "bg-accent text-white dark:bg-accent-light dark:text-black"
                : "bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {expanded ? "Hide details" : "Show details"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* System Specs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-[var(--background)] p-3">
              <Cpu className="h-4 w-4 text-[var(--muted)]" />
              <div>
                <p className="text-xs text-[var(--muted)]">CPU</p>
                <p className="text-sm font-medium truncate">
                  {sysInfo.cpu_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[var(--background)] p-3">
              <HardDrive className="h-4 w-4 text-[var(--muted)]" />
              <div>
                <p className="text-xs text-[var(--muted)]">RAM</p>
                <p className="text-sm font-medium">
                  {sysInfo.ram_total_gb}GB (
                  {sysInfo.ram_available_gb.toFixed(1)}GB free)
                </p>
              </div>
            </div>
            {sysInfo.gpu_name && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--background)] p-3 col-span-2">
                <Monitor className="h-4 w-4 text-[var(--muted)]" />
                <div>
                  <p className="text-xs text-[var(--muted)]">GPU</p>
                  <p className="text-sm font-medium">
                    {sysInfo.gpu_name} — {sysInfo.gpu_vram_gb}GB VRAM
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-lg bg-[var(--background)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-hf-orange" />
                <span className="text-xs font-medium text-[var(--foreground)]">
                  Suggestions
                </span>
              </div>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="text-sm text-[var(--muted)] flex items-start gap-2"
                  >
                    <span className="text-hf-orange">→</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tier context */}
          {tierInfo && (
            <div className="rounded-lg bg-[var(--background)] p-3 flex items-center gap-2">
              <span className="text-lg">{tierInfo.icon}</span>
              <div>
                <p className="text-sm font-medium">Your hardware: {tierInfo.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  Recommended max: ~{tierInfo.maxModelParams}B params
                  {params > tierInfo.maxModelParams && (
                    <span className="text-red-500 ml-1">
                      (this model is {params.toFixed(0)}B — above your tier)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Quantization comparison table toggle */}
          <button
            onClick={() => setShowQuantTable(!showQuantTable)}
            className="text-xs text-accent dark:text-accent-light hover:underline"
          >
            {showQuantTable ? "Hide comparison table ▲" : "📊 Show all quantizations compared ▼"}
          </button>

          {showQuantTable && (
            <QuantComparison
              paramsB={params}
              ramGb={sysInfo.ram_available_gb}
              vramGb={sysInfo.gpu_vram_gb}
              selectedQuant={quant}
              onSelectQuant={setSelectedQuant}
            />
          )}

          {/* Space check */}
          <SpaceCheck modelSizeGb={modelSizeGb} />
        </div>
      )}
    </div>
  );
}
