import { Skeleton } from "../ui/Skeleton";

export function ModelCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="flex gap-1.5 mb-3">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <div className="mt-auto pt-2 border-t border-[var(--border-subtle)] flex gap-4">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}
