import { cn } from "./cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "outline" | "green" | "yellow" | "red" | "orange";
  className?: string;
}

const variants = {
  default: "bg-[var(--surface-hover)] text-[var(--foreground)]",
  outline: "border border-[var(--border)] text-[var(--muted)]",
  green:
    "bg-can-run/15 text-can-run dark:bg-can-run-light/15 dark:text-can-run-light",
  yellow:
    "bg-maybe-run/15 text-maybe-run dark:bg-maybe-run-light/15 dark:text-maybe-run-light",
  red: "bg-cant-run/15 text-cant-run dark:bg-cant-run-light/15 dark:text-cant-run-light",
  orange: "bg-hf-orange/15 text-hf-orange dark:text-hf-orange-light",
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
