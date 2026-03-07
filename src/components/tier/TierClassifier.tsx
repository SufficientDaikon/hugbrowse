import { useTier } from "../../hooks/useTier";
import { useSystemInfo } from "../../hooks/useSystemInfo";
import { TierBadge } from "./TierBadge";
import { TIER_INFO } from "../../lib/constants";
import { Cpu, HardDrive, Monitor } from "lucide-react";

export function TierClassifier() {
  const { data: tierInfo } = useTier();
  const { data: sysInfo } = useSystemInfo();

  if (!tierInfo || !sysInfo) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 animate-pulse">
        <div className="h-6 w-48 bg-[var(--surface-hover)] rounded mb-2" />
        <div className="h-4 w-72 bg-[var(--surface-hover)] rounded" />
      </div>
    );
  }

  const info = TIER_INFO[tierInfo.tier];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">{info.icon}</span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{info.name}</h2>
            <TierBadge tier={tierInfo.tier} size="sm" showName={false} />
            {tierInfo.isOverridden && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                ⚠️ Manual override
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--muted)]">{info.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--background)] p-3">
          <Cpu className="h-4 w-4 text-[var(--muted)]" />
          <div>
            <p className="text-xs text-[var(--muted)]">CPU</p>
            <p className="text-sm font-medium truncate">{sysInfo.cpu_name}</p>
            <p className="text-xs text-[var(--muted)]">
              {sysInfo.cpu_cores} cores
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[var(--background)] p-3">
          <HardDrive className="h-4 w-4 text-[var(--muted)]" />
          <div>
            <p className="text-xs text-[var(--muted)]">RAM</p>
            <p className="text-sm font-medium">{sysInfo.ram_total_gb} GB</p>
            <p className="text-xs text-[var(--muted)]">
              {sysInfo.ram_available_gb} GB free
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[var(--background)] p-3">
          <Monitor className="h-4 w-4 text-[var(--muted)]" />
          <div>
            <p className="text-xs text-[var(--muted)]">GPU</p>
            <p className="text-sm font-medium truncate">
              {sysInfo.gpu_name ?? "No discrete GPU"}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {sysInfo.gpu_vram_gb
                ? `${sysInfo.gpu_vram_gb} GB VRAM`
                : "Integrated (shared)"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-[var(--muted)]">
        Max recommended model:{" "}
        <strong className="text-[var(--foreground)]">
          {info.maxParams}B parameters
        </strong>{" "}
        with Q4_K_M quantization
      </div>
    </div>
  );
}
