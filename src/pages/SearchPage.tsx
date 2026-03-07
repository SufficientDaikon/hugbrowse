import { useEffect, useRef, useCallback } from "react";
import { useModels } from "../hooks/useModels";
import { ModelGrid } from "../components/models/ModelGrid";
import { SortDropdown } from "../components/search/SortDropdown";
import { useSearchStore } from "../stores/search";
import { Badge } from "../components/ui/Badge";
import { Loader2 } from "lucide-react";

export function SearchPage() {
  const { query, activeFilters } = useSearchStore();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useModels();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const models = data?.pages.flat() ?? [];

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  const hasActiveFilters =
    activeFilters.tasks.length > 0 || activeFilters.libraries.length > 0;

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {query
              ? `Results for "${query}"`
              : hasActiveFilters
                ? "Filtered Models"
                : "🔥 Trending Models"}
          </h1>
          {!isLoading && (
            <p className="text-sm text-[var(--muted)] mt-1">
              {models.length} models loaded
            </p>
          )}
        </div>
        <SortDropdown />
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.tasks.map((t) => (
            <Badge key={t} variant="orange">
              {t}
            </Badge>
          ))}
          {activeFilters.libraries.map((l) => (
            <Badge key={l} variant="default">
              {l}
            </Badge>
          ))}
        </div>
      )}

      {/* Model Grid */}
      <ModelGrid
        models={models}
        isLoading={isLoading}
        isFetchingNext={isFetchingNextPage}
      />

      {/* Infinite scroll trigger */}
      <div
        ref={loadMoreRef}
        className="h-10 mt-4 flex items-center justify-center"
      >
        {isFetchingNextPage && (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
        )}
      </div>
    </div>
  );
}
