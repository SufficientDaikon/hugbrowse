import { cn } from "./cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "outline" | "green" | "yellow" | "red" | "orange";
  className?: string;
}

const variants = {
  default:
    "bg-[var(--surface-hover)] text-[var(--foreground)] border border-[var(--border-subtle)]",
  outline: "border border-[var(--border)] text-[var(--muted)]",
  green:
    "bg-can-run/10 text-can-run dark:bg-can-run-light/10 dark:text-can-run-light border border-can-run/20 dark:border-can-run-light/20",
  yellow:
    "bg-maybe-run/10 text-maybe-run dark:bg-maybe-run-light/10 dark:text-maybe-run-light border border-maybe-run/20 dark:border-maybe-run-light/20",
  red: "bg-cant-run/10 text-cant-run dark:bg-cant-run-light/10 dark:text-cant-run-light border border-cant-run/20 dark:border-cant-run-light/20",
  orange:
    "bg-hf-orange/10 text-hf-orange dark:text-hf-orange-light border border-hf-orange/20",
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
