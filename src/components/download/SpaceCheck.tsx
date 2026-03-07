import { useQuery } from "@tanstack/react-query";
import type { DiskSpaceInfo } from "../../lib/hf-types";
import { HardDrive, Check, X, AlertTriangle } from "lucide-react";

async function getDiskSpace(): Promise<DiskSpaceInfo> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DiskSpaceInfo>("check_disk_space", { path: "." });
  } catch {
    return { total_gb: 500, free_gb: 120, available_gb: 120, path: "." };
  }
}

interface SpaceCheckProps {
  modelSizeGb: number;
}

export function SpaceCheck({ modelSizeGb }: SpaceCheckProps) {
  const { data: diskInfo } = useQuery({
    queryKey: ["disk-space"],
    queryFn: getDiskSpace,
    staleTime: 30_000,
  });

  if (!diskInfo) return null;

  const hasEnoughSpace = diskInfo.free_gb >= modelSizeGb * 2;
  const tight = diskInfo.free_gb >= modelSizeGb && !hasEnoughSpace;
  const downloadTimeSec = (modelSizeGb * 1024) / (50 / 8); // assume 50 Mbps

  const formatTime = (secs: number) => {
    if (secs < 60) return `${Math.round(secs)} seconds`;
    if (secs < 3600) return `~${Math.round(secs / 60)} minutes`;
    return `~${(secs / 3600).toFixed(1)} hours`;
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <HardDrive className="h-4 w-4" />
        Download Check
      </h4>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Model size</span>
          <span className="font-mono font-medium">
            {modelSizeGb.toFixed(1)} GB
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Disk free</span>
          <span className="font-mono font-medium">
            {diskInfo.free_gb.toFixed(0)} GB
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Est. download time</span>
          <span className="font-mono text-xs">
            {formatTime(downloadTimeSec)} at 50 Mbps
          </span>
        </div>

        {/* Status */}
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg p-2.5 text-sm ${
            hasEnoughSpace
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : tight
                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {hasEnoughSpace && <Check className="h-4 w-4" />}
          {tight && <AlertTriangle className="h-4 w-4" />}
          {!hasEnoughSpace && !tight && <X className="h-4 w-4" />}
          <span>
            {hasEnoughSpace && "Plenty of space"}
            {tight && "Tight on space — may need cleanup"}
            {!hasEnoughSpace &&
              !tight &&
              `Not enough space — need ${modelSizeGb.toFixed(1)} GB but only ${diskInfo.free_gb.toFixed(0)} GB available`}
          </span>
        </div>
      </div>
    </div>
  );
}
