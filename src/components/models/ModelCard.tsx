import { useNavigate } from "react-router-dom";
import { Download, Heart, ArrowUpRight } from "lucide-react";
import type { HFModel } from "../../lib/hf-types";
import { Badge } from "../ui/Badge";
import { cn } from "../ui/cn";
import {
  formatNumber,
  estimateModelParams,
  detectQuantization,
  quickCompatCheck,
} from "../../lib/compatibility";
import { useSystemInfo } from "../../hooks/useSystemInfo";

interface ModelCardProps {
  model: HFModel;
}

const compatStyles: Record<
  string,
  { dot: string; ring: string; label: string }
> = {
  green: {
    dot: "bg-can-run dark:bg-can-run-light",
    ring: "ring-can-run/20 dark:ring-can-run-light/20",
    label: "Can run on GPU",
  },
  yellow: {
    dot: "bg-maybe-run dark:bg-maybe-run-light",
    ring: "ring-maybe-run/20 dark:ring-maybe-run-light/20",
    label: "Can run on CPU",
  },
  red: {
    dot: "bg-cant-run dark:bg-cant-run-light",
    ring: "ring-cant-run/20 dark:ring-cant-run-light/20",
    label: "Too large",
  },
  unknown: {
    dot: "bg-[var(--muted-foreground)]",
    ring: "ring-[var(--muted-foreground)]/20",
    label: "Size unknown",
  },
};

export function ModelCard({ model }: ModelCardProps) {
  const navigate = useNavigate();
  const { data: sysInfo } = useSystemInfo();

  const params = estimateModelParams(model);
  const quant = detectQuantization(model);
  const compat = sysInfo
    ? quickCompatCheck(
        params,
        quant,
        sysInfo.ram_available_gb,
        sysInfo.gpu_vram_gb,
      )
    : "unknown";

  const style = compatStyles[compat];
  const author = model.id.split("/")[0];
  const name = model.id.split("/").slice(1).join("/");

  return (
    <button
      onClick={() => navigate(`/model/${encodeURIComponent(model.id)}`)}
      className={cn(
        "group relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left",
        "card-elevated",
        "hover:border-hf-orange/30",
        "transition-colors duration-200",
      )}
    >
      {/* Hover arrow */}
      <ArrowUpRight className="absolute top-3 right-3 h-3.5 w-3.5 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 group-hover:text-hf-orange transition-all duration-200" />

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Compat indicator */}
        <div
          className={cn(
            "mt-1 h-2.5 w-2.5 rounded-full ring-4 shrink-0",
            style.dot,
            style.ring,
          )}
          title={style.label}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[var(--muted)] truncate">{author}</p>
          <p className="font-semibold text-sm text-[var(--foreground)] truncate group-hover:text-hf-orange transition-colors leading-tight">
            {name || model.id}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {model.pipeline_tag && (
          <Badge variant="orange">{model.pipeline_tag}</Badge>
        )}
        {params && (
          <Badge variant="default">
            {params >= 1 ? `${params}B` : `${Math.round(params * 1000)}M`}{" "}
            params
          </Badge>
        )}
        {model.library_name && (
          <Badge variant="outline">{model.library_name}</Badge>
        )}
        {model.tags?.includes("gguf") && <Badge variant="green">GGUF</Badge>}
      </div>

      {/* Stats */}
      <div className="mt-auto flex items-center gap-4 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {formatNumber(model.downloads)}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-3 w-3" />
          {formatNumber(model.likes)}
        </span>
      </div>
    </button>
  );
}
