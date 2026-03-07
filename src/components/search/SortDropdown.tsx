import { useSearchStore } from "../../stores/search";
import { SORT_OPTIONS } from "../../lib/constants";
import { cn } from "../ui/cn";
import { ArrowUpDown } from "lucide-react";

export function SortDropdown() {
  const { sort, setSort } = useSearchStore();

  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-4 w-4 text-[var(--muted)]" />
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        className={cn(
          "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm",
          "text-[var(--foreground)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
        )}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
