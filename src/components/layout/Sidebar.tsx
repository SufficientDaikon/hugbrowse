import { TASK_CATEGORIES, LIBRARY_FILTERS } from "../../lib/constants";
import { useSearchStore } from "../../stores/search";
import { cn } from "../ui/cn";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useState } from "react";

export function Sidebar() {
  const { activeFilters, toggleTask, toggleLibrary, clearFilters } =
    useSearchStore();
  const [tasksOpen, setTasksOpen] = useState(true);
  const [libsOpen, setLibsOpen] = useState(true);

  const hasFilters =
    activeFilters.tasks.length > 0 || activeFilters.libraries.length > 0;

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Filters
        </h2>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-cant-run transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Task Filters */}
      <div className="mb-6">
        <button
          onClick={() => setTasksOpen(!tasksOpen)}
          className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--muted)] mb-2"
        >
          Tasks
          {tasksOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        {tasksOpen && (
          <div className="space-y-1">
            {TASK_CATEGORIES.map((task) => (
              <button
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  activeFilters.tasks.includes(task.id)
                    ? "bg-hf-orange/10 text-hf-orange dark:text-hf-orange-light font-medium"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                )}
              >
                <span className="text-base">{task.icon}</span>
                <span className="truncate">{task.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Library Filters */}
      <div>
        <button
          onClick={() => setLibsOpen(!libsOpen)}
          className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--muted)] mb-2"
        >
          Libraries
          {libsOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        {libsOpen && (
          <div className="space-y-1">
            {LIBRARY_FILTERS.map((lib) => (
              <button
                key={lib}
                onClick={() => toggleLibrary(lib)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  activeFilters.libraries.includes(lib)
                    ? "bg-accent/10 text-accent dark:text-accent-light font-medium"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                )}
              >
                <span className="font-mono text-xs">{lib}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
