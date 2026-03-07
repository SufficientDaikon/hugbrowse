import type { LiveResources } from "../../lib/hf-types";
import { useTier } from "../../hooks/useTier";
import { QUANTIZATION_TYPES } from "../../lib/constants";

interface HeadroomCardProps {
  resources: LiveResources;
}

export function HeadroomCard({ resources }: HeadroomCardProps) {
  const { data: tierInfo } = useTier();

  const availableRam = resources.ram_total_gb - resources.ram_used_gb;
  const availableVram =
    resources.vram_total_gb && resources.vram_used_gb != null
      ? resources.vram_total_gb - resources.vram_used_gb
      : null;

  // Figure out what size model can be loaded
  const usableMemory = availableVram ?? availableRam * 0.8; // leave 20% headroom for OS
  const usableForModel = usableMemory * 0.85; // leave room for KV cache
  const q4BytesPerParam = QUANTIZATION_TYPES.find(
    (q) => q.id === "q4_k_m",
  )!.bytesPerParam;
  const maxParamsB = usableForModel / q4BytesPerParam;

  let suggestion: string;
  let suggestionIcon: string;
  if (maxParamsB >= 70) {
    suggestion = "Can load a 70B Q4 model or multiple smaller models";
    suggestionIcon = "🚀";
  } else if (maxParamsB >= 13) {
    suggestion = `Can load up to a ${Math.floor(maxParamsB)}B Q4 model`;
    suggestionIcon = "✅";
  } else if (maxParamsB >= 7) {
    suggestion = "Can load a 7B Q4 model";
    suggestionIcon = "👍";
  } else if (maxParamsB >= 3) {
    suggestion = "Can load a 3B Q4 model (e.g., Phi-3-mini)";
    suggestionIcon = "⚡";
  } else {
    suggestion = "Limited headroom — close other apps first";
    suggestionIcon = "⚠️";
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold mb-3">💡 What Can I Load?</h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-[var(--background)] p-3">
          <p className="text-xs text-[var(--muted)]">Available RAM</p>
          <p className="text-lg font-bold">{availableRam.toFixed(1)} GB</p>
        </div>
        {availableVram != null ? (
          <div className="rounded-lg bg-[var(--background)] p-3">
            <p className="text-xs text-[var(--muted)]">Available VRAM</p>
            <p className="text-lg font-bold">{availableVram.toFixed(1)} GB</p>
          </div>
        ) : (
          <div className="rounded-lg bg-[var(--background)] p-3">
            <p className="text-xs text-[var(--muted)]">GPU</p>
            <p className="text-sm text-[var(--muted)]">No discrete GPU</p>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-accent/5 dark:bg-accent-light/5 p-3 border border-accent/20 dark:border-accent-light/20">
        <span className="text-xl">{suggestionIcon}</span>
        <div>
          <p className="text-sm font-medium">{suggestion}</p>
          {tierInfo && (
            <p className="text-xs text-[var(--muted)] mt-1">
              Your tier: {tierInfo.icon} {tierInfo.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
