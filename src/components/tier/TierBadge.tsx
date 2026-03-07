import { cn } from "../ui/cn";
import { TIER_INFO } from "../../lib/constants";
import type { HardwareTier } from "../../lib/hf-types";

interface TierBadgeProps {
  tier: HardwareTier;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

export function TierBadge({
  tier,
  size = "sm",
  showName = true,
  className,
}: TierBadgeProps) {
  const info = TIER_INFO[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base",
        "bg-[var(--surface-hover)] text-[var(--foreground)]",
        className,
      )}
    >
      <span>{info.icon}</span>
      {showName && <span>{info.name}</span>}
    </span>
  );
}
