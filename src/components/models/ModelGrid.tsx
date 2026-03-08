import type { HFModel } from "../../lib/hf-types";
import { ModelCard } from "./ModelCard";
import { ModelCardSkeleton } from "./ModelCardSkeleton";
import { SearchX } from "lucide-react";

interface ModelGridProps {
  models: HFModel[];
  isLoading?: boolean;
  isFetchingNext?: boolean;
}

export function ModelGrid({
  models,
  isLoading,
  isFetchingNext,
}: ModelGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <ModelCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-hover)] mb-4">
          <SearchX className="h-7 w-7 text-[var(--muted)]" />
        </div>
        <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">
          No models found
        </h3>
        <p className="text-sm text-[var(--muted)] max-w-xs">
          Try adjusting your search query or filters to find what you're looking
          for
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {models.map((model) => (
          <ModelCard key={model._id || model.id} model={model} />
        ))}
      </div>
      {isFetchingNext && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ModelCardSkeleton key={`loading-${i}`} />
          ))}
        </div>
      )}
    </>
  );
}
