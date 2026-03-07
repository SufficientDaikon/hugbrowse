import { useTier } from "../hooks/useTier";
import { useRecommendations } from "../hooks/useRecommendations";
import { TierBadge } from "../components/tier/TierBadge";
import { TIER_INFO, RECOMMEND_TASKS, SPEED_LABELS } from "../lib/constants";
import { Loader2, Star, Zap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ModelRecommendation } from "../lib/hf-types";

function RecommendedCard({ rec }: { rec: ModelRecommendation }) {
  const speedInfo = SPEED_LABELS[rec.estimatedSpeed];
  const modelName = rec.model.id.split("/")[1] ?? rec.model.id;
  return (
    <Link
      to={`/model/${encodeURIComponent(rec.model.id)}`}
      className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-accent/50 dark:hover:border-accent-light/50 transition-all hover:shadow-md group"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold group-hover:text-accent dark:group-hover:text-accent-light transition-colors line-clamp-1">
          {modelName}
        </h4>
        <ArrowRight className="h-4 w-4 text-[var(--muted)] group-hover:text-accent dark:group-hover:text-accent-light transition-colors" />
      </div>
      <p className="text-xs text-[var(--muted)] mb-3 line-clamp-1">{rec.reason}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
          {rec.recommendedQuant.toUpperCase()}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${speedInfo.color}`}>
          <Zap className="h-3 w-3 inline mr-0.5" />
          {speedInfo.label}
        </span>
        {rec.model.downloads > 0 && (
          <span className="text-xs text-[var(--muted)] flex items-center gap-0.5">
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
      <h3 className="text-lg font-semibold mb-3">{taskLabel}</h3>
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
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-accent/5 to-purple-500/5 dark:from-accent-light/5 dark:to-purple-400/5 p-6 md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              🤖 Recommended For You
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-xl">
              Models curated for your hardware. We've analyzed your system and
              picked the best models that will run smoothly on your machine.
            </p>
          </div>
          {!tierLoading && <TierBadge tier={tier} />}
        </div>

        {/* Specs summary */}
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="text-xs px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            {info.icon} {info.name}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            Max recommended: ~{info.maxParams}B params
          </span>
          <Link
            to="/settings"
            className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent dark:text-accent-light hover:bg-accent/20 transition-colors"
          >
            Override tier →
          </Link>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)]">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
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
        <div className="text-center py-12">
          <p className="text-lg">🤷 No recommendations available</p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Make sure system info is detected. Try searching for models manually.
          </p>
        </div>
      )}
    </div>
  );
}
