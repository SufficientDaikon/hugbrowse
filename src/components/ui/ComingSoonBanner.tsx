import { Construction } from "lucide-react";

/** Reusable "Coming Soon" overlay banner for features still in development */
export function ComingSoonBanner({ feature }: { feature: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-maybe-run/10 dark:bg-maybe-run-light/10 shrink-0">
        <Construction className="h-4 w-4 text-maybe-run dark:text-maybe-run-light" />
      </div>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        <span className="font-semibold text-[var(--foreground)]">Coming Soon</span> — {feature} is under
        active development and not yet functional.
      </p>
    </div>
  );
}
