import { TASK_CATEGORIES, LIBRARY_FILTERS } from "../../lib/constants";
import { useSearchStore } from "../../stores/search";
import { cn } from "../ui/cn";
import { ChevronDown, ChevronRight, X, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

export function Sidebar() {
  const { activeFilters, toggleTask, toggleLibrary, clearFilters } =
    useSearchStore();
  const [tasksOpen, setTasksOpen] = useState(true);
  const [libsOpen, setLibsOpen] = useState(true);

  const hasFilters =
    activeFilters.tasks.length > 0 || activeFilters.libraries.length > 0;

  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--muted)]" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Filters
          </h2>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-[10px] font-medium text-cant-run dark:text-cant-run-light hover:underline transition-colors"
          >
            <X className="h-2.5 w-2.5" /> Clear all
          </button>
        )}
      </div>

      {/* Task Filters */}
      <div className="mb-4">
        <button
          onClick={() => setTasksOpen(!tasksOpen)}
          className="flex w-full items-center justify-between px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Tasks
          {tasksOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        {tasksOpen && (
          <div className="mt-1 space-y-0.5">
            {TASK_CATEGORIES.map((task) => {
              const isActive = activeFilters.tasks.includes(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150",
                    isActive
                      ? "bg-hf-orange/10 text-hf-orange dark:text-hf-orange-light font-medium shadow-sm"
                      : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="text-sm">{task.icon}</span>
                  <span className="truncate">{task.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Library Filters */}
      <div>
        <button
          onClick={() => setLibsOpen(!libsOpen)}
          className="flex w-full items-center justify-between px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Libraries
          {libsOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        {libsOpen && (
          <div className="mt-1 space-y-0.5">
            {LIBRARY_FILTERS.map((lib) => {
              const isActive = activeFilters.libraries.includes(lib);
              return (
                <button
                  key={lib}
                  onClick={() => toggleLibrary(lib)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150",
                    isActive
                      ? "bg-accent/10 text-accent dark:text-accent-light font-medium shadow-sm"
                      : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="font-mono text-xs">{lib}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
