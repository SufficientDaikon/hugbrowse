import { cn } from "../ui/cn";

interface ResourceGaugeProps {
  label: string;
  icon: string;
  value: number; // 0-100
  used?: string;
  total?: string;
  color?: string;
  unavailable?: boolean;
  unavailableText?: string;
}

/** Returns a utilization-based color for the gauge arc */
export function getUtilizationColor(value: number): string {
  if (value >= 80) return "#ef4444"; // red — critical
  if (value >= 50) return "#f59e0b"; // amber — warning
  return "#22c55e"; // green — healthy
}

export function ResourceGauge({
  label,
  icon,
  value,
  used,
  total,
  color: _color,
  unavailable,
  unavailableText,
}: ResourceGaugeProps) {
  const radius = 44;
  const stroke = 7;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (Math.min(value, 100) / 100) * circumference;

  const gaugeColor = getUtilizationColor(value);

  if (unavailable) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div
          className="relative"
          style={{ width: radius * 2, height: radius * 2 }}
        >
          <svg width={radius * 2} height={radius * 2} className="opacity-30">
            <circle
              cx={radius}
              cy={radius}
              r={normalizedRadius}
              fill="transparent"
              stroke="var(--border)"
              strokeWidth={stroke}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-[var(--muted)]">N/A</span>
          </div>
        </div>
        <span className="text-xs font-medium">
          {icon} {label}
        </span>
        <span className="text-[11px] text-[var(--muted)] text-center leading-tight">
          {unavailableText ?? "Not detected"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div
        className="relative"
        style={{ width: radius * 2, height: radius * 2 }}
      >
        <svg width={radius * 2} height={radius * 2} className="-rotate-90">
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="transparent"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="transparent"
            stroke={gaugeColor}
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition:
                "stroke-dashoffset 0.6s ease-out, stroke 0.6s ease-out",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-base font-bold tabular-nums",
              value >= 80 && "text-red-500",
            )}
          >
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-medium">
        {icon} {label}
      </span>
      {used && total && (
        <span className="text-[11px] text-[var(--muted)] tabular-nums">
          {used} / {total}
        </span>
      )}
    </div>
  );
}
