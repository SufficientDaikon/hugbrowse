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

export function ResourceGauge({
  label,
  icon,
  value,
  used,
  total,
  color = "var(--accent)",
  unavailable,
  unavailableText,
}: ResourceGaugeProps) {
  const radius = 48;
  const stroke = 8;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (Math.min(value, 100) / 100) * circumference;

  const gaugeColor =
    value >= 90 ? "var(--cant-run)" : value >= 70 ? "var(--maybe-run)" : color;

  if (unavailable) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
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
            <span className="text-lg text-[var(--muted)]">N/A</span>
          </div>
        </div>
        <span className="text-sm font-medium">
          {icon} {label}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {unavailableText ?? "Not detected"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
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
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn("text-lg font-bold", value >= 90 && "text-red-500")}
          >
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <span className="text-sm font-medium">
        {icon} {label}
      </span>
      {used && total && (
        <span className="text-xs text-[var(--muted)]">
          {used} / {total}
        </span>
      )}
    </div>
  );
}
