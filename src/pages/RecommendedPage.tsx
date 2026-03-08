import { useTier } from "../hooks/useTier";
import { useRecommendations } from "../hooks/useRecommendations";
import { TierBadge } from "../components/tier/TierBadge";
import { TIER_INFO, RECOMMEND_TASKS, SPEED_LABELS } from "../lib/constants";
import { Loader2, Star, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { ModelRecommendation } from "../lib/hf-types";

function RecommendedCard({ rec }: { rec: ModelRecommendation }) {
  const speedInfo = SPEED_LABELS[rec.estimatedSpeed];
  const modelName = rec.model.id.split("/")[1] ?? rec.model.id;
  return (
    <Link
      to={`/model/${encodeURIComponent(rec.model.id)}`}
      className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-accent/40 dark:hover:border-accent-light/40 transition-all duration-200 hover:shadow-md group"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold group-hover:text-accent dark:group-hover:text-accent-light transition-colors line-clamp-1">
          {modelName}
        </h4>
        <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] group-hover:text-accent dark:group-hover:text-accent-light group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-xs text-[var(--muted)] mb-3 line-clamp-1">{rec.reason}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/15 font-medium">
          {rec.recommendedQuant.toUpperCase()}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${speedInfo.color}`}>
          <Zap className="h-3 w-3 inline mr-0.5" />
          {speedInfo.label}
        </span>
        {rec.model.downloads > 0 && (
          <span className="text-[11px] text-[var(--muted)] flex items-center gap-0.5">
            <Star className="h-3 w-3" />
            {rec.model.downloads > 1000
              ? `${(rec.model.downloads / 1000).toFixed(0)}k`
              : rec.model.downloads}
          </span>
        )}
      </div>
    </Link>
  );
}

function TaskSection({
  task,
  recs,
}: {
  task: string;
  recs: ModelRecommendation[];
}) {
  const taskObj = RECOMMEND_TASKS.find((t) => t.id === task);
  const taskLabel = taskObj ? `${taskObj.icon} ${taskObj.label}` : task;
  return (
    <div>
      <h3 className="text-base font-bold mb-3">{taskLabel}</h3>
      {recs.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No compatible models found for this task.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recs.map((rec) => (
            <RecommendedCard key={rec.model.id} rec={rec} />
          ))}
        </div>
      )}
    </div>
  );
}

export function RecommendedPage() {
  const { data: tierInfo, isLoading: tierLoading } = useTier();
  const { data: recommendations, isLoading } = useRecommendations();
  const tier = tierInfo?.tier ?? "laptop";
  const info = TIER_INFO[tier];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 relative overflow-hidden">
        {/* Subtle gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.03] via-transparent to-purple-500/[0.03] pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/15 shrink-0">
                <Sparkles className="h-6 w-6 text-accent dark:text-accent-light" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                  Recommended For You
                </h1>
                <p className="text-sm text-[var(--muted)] max-w-xl leading-relaxed">
                  Models curated for your hardware. We've analyzed your system and
                  picked the best models that will run smoothly on your machine.
                </p>
              </div>
            </div>
            {!tierLoading && <TierBadge tier={tier} />}
          </div>

          {/* Specs summary */}
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)]">
              {info.icon} {info.name}
            </span>
            <span className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)]">
              Max ~{info.maxParams}B params
            </span>
            <Link
              to="/settings"
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-accent/10 text-accent dark:text-accent-light hover:bg-accent/15 transition-colors"
            >
              Override tier →
            </Link>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-accent" />
          <p className="text-sm">
            Finding the best models for your hardware...
          </p>
        </div>
      )}

      {/* Task sections */}
      {!isLoading && recommendations &&
        RECOMMEND_TASKS.map((task) => {
          const recs = recommendations[task.id] ?? [];
          return <TaskSection key={task.id} task={task.id} recs={recs} />;
        })}

      {!isLoading && !recommendations && (
        <div className="text-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-hover)] mx-auto mb-4">
            <Sparkles className="h-7 w-7 text-[var(--muted)]" />
          </div>
          <p className="text-base font-semibold mb-1">No recommendations available</p>
          <p className="text-sm text-[var(--muted)]">
            Make sure system info is detected. Try searching for models manually.
          </p>
        </div>
      )}
    </div>
  );
}
