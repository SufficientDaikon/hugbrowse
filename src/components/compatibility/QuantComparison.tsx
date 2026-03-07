import {
  QUANTIZATION_TYPES,
  QUANT_QUALITY,
  estimateSpeed,
  SPEED_LABELS,
} from "../../lib/constants";
import { cn } from "../ui/cn";
import type { CompatStatus } from "../../lib/hf-types";

interface QuantComparisonProps {
  paramsB: number;
  ramGb: number;
  vramGb: number | null;
  selectedQuant: string;
  onSelectQuant: (quant: string) => void;
}

export function QuantComparison({
  paramsB,
  ramGb,
  vramGb,
  selectedQuant,
  onSelectQuant,
}: QuantComparisonProps) {
  const rows = QUANTIZATION_TYPES.map((q) => {
    const sizeGb = paramsB * q.bytesPerParam;
    const neededGb = sizeGb * 1.2;
    const gpuOk = vramGb ? vramGb >= neededGb : false;
    const cpuOk = ramGb >= neededGb * 1.1;
    const status: CompatStatus = gpuOk ? "green" : cpuOk ? "yellow" : "red";
    const speed = estimateSpeed(
      paramsB,
      q.bytesPerParam,
      !!vramGb && vramGb > 2,
      vramGb ?? 0,
    );
    const stars = QUANT_QUALITY[q.id] ?? 3;

    // Determine if this is the recommended quant
    const recommended =
      status !== "red" &&
      ((gpuOk && q.id === "q4_k_m") ||
        (gpuOk &&
          !QUANTIZATION_TYPES.some(
            (oq) =>
              oq.bytesPerParam > q.bytesPerParam &&
              vramGb! >= paramsB * oq.bytesPerParam * 1.2,
          )) ||
        (!gpuOk && cpuOk && q.id === "q4_k_m"));

    return { ...q, sizeGb, neededGb, status, speed, stars, recommended };
  });

  // Find the best recommended row (highest quality that still fits)
  const bestRec =
    rows.find((r) => r.status === "green") ??
    rows.find((r) => r.status === "yellow");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h4 className="text-sm font-semibold">📊 Quantization Comparison</h4>
        <p className="text-xs text-[var(--muted)]">
          Compare size, speed, and quality for {paramsB.toFixed(1)}B model
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <th className="text-left px-4 py-2 font-medium">Quant</th>
              <th className="text-right px-4 py-2 font-medium">Size</th>
              <th className="text-right px-4 py-2 font-medium">VRAM Needed</th>
              <th className="text-center px-4 py-2 font-medium">Speed</th>
              <th className="text-center px-4 py-2 font-medium">Quality</th>
              <th className="text-center px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.id === selectedQuant;
              const isBest = bestRec && row.id === bestRec.id;
              const speedInfo = SPEED_LABELS[row.speed];

              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectQuant(row.id)}
                  className={cn(
                    "border-b border-[var(--border)] cursor-pointer transition-colors",
                    isSelected && "bg-accent/10 dark:bg-accent-light/10",
                    isBest && !isSelected && "bg-green-500/5",
                    !isSelected && !isBest && "hover:bg-[var(--surface-hover)]",
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.label}</span>
                      {isBest && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium">
                          ✅ Best for you
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {row.sizeGb.toFixed(1)} GB
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {row.neededGb.toFixed(1)} GB
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={cn("text-xs font-medium", speedInfo.color)}
                    >
                      {speedInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-yellow-500 text-xs tracking-wider">
                    {"★".repeat(row.stars)}
                    {"☆".repeat(5 - row.stars)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.status === "green" && (
                      <span className="text-green-500 text-xs font-medium">
                        🟢 GPU
                      </span>
                    )}
                    {row.status === "yellow" && (
                      <span className="text-yellow-500 text-xs font-medium">
                        🟡 CPU
                      </span>
                    )}
                    {row.status === "red" && (
                      <span className="text-red-500 text-xs font-medium">
                        🔴 No
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
