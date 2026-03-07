import { useNavigate } from "react-router-dom";
import { Download, Heart } from "lucide-react";
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

const compatDots: Record<string, string> = {
  green: "bg-can-run dark:bg-can-run-light",
  yellow: "bg-maybe-run dark:bg-maybe-run-light",
  red: "bg-cant-run dark:bg-cant-run-light",
  unknown: "bg-[var(--muted-foreground)]",
};

const compatLabels: Record<string, string> = {
  green: "Can run on GPU",
  yellow: "Can run on CPU",
  red: "Too large",
  unknown: "Size unknown",
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

  const author = model.id.split("/")[0];
  const name = model.id.split("/").slice(1).join("/");

  return (
    <button
      onClick={() => navigate(`/model/${encodeURIComponent(model.id)}`)}
      className={cn(
        "group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left",
        "hover:border-hf-orange/50 hover:shadow-lg hover:shadow-hf-orange/5 hover:scale-[1.02]",
        "transition-all duration-150 ease-out",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)] truncate">{author}</p>
          <p className="font-semibold text-sm text-[var(--foreground)] truncate group-hover:text-hf-orange transition-colors">
            {name || model.id}
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 shrink-0"
          title={compatLabels[compat]}
        >
          <div className={cn("h-2.5 w-2.5 rounded-full", compatDots[compat])} />
        </div>
      </div>

      {/* Task Badge */}
      {model.pipeline_tag && (
        <Badge variant="orange" className="mb-3 self-start">
          {model.pipeline_tag}
        </Badge>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {params && (
          <Badge variant="default">
            {params >= 1 ? `${params}B` : `${Math.round(params * 1000)}M`}{" "}
            params
          </Badge>
        )}
        {model.library_name && (
          <Badge variant="outline">{model.library_name}</Badge>
        )}
        {model.tags?.includes("gguf") && <Badge variant="default">GGUF</Badge>}
      </div>

      {/* Stats */}
      <div className="mt-auto flex items-center gap-4 text-xs text-[var(--muted)]">
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
