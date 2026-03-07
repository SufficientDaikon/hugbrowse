import { useQuery } from "@tanstack/react-query";
import { hfApi } from "../lib/hf-api";
import { estimateModelParams, quickCompatCheck } from "../lib/compatibility";
import { useTier } from "./useTier";
import { useSystemInfo } from "./useSystemInfo";
import {
  estimateSpeed,
  QUANTIZATION_TYPES,
  RECOMMEND_TASKS,
} from "../lib/constants";
import type {
  HFModel,
  ModelRecommendation,
  HardwareTier,
} from "../lib/hf-types";

function getBestQuant(
  paramsB: number,
  ramGb: number,
  vramGb: number | null,
): string {
  for (const q of QUANTIZATION_TYPES) {
    const needed = paramsB * q.bytesPerParam * 1.2;
    if (vramGb && vramGb >= needed) return q.id;
  }
  for (const q of QUANTIZATION_TYPES) {
    const needed = paramsB * q.bytesPerParam * 1.32;
    if (ramGb >= needed) return q.id;
  }
  return "q2_k";
}

function filterByTier(
  models: HFModel[],
  tier: HardwareTier,
  ramGb: number,
  vramGb: number | null,
): ModelRecommendation[] {
  const maxParams: Record<HardwareTier, number> = {
    potato: 3,
    laptop: 7,
    gaming: 13,
    workstation: 70,
    server: 200,
  };
  const max = maxParams[tier];

  return models
    .map((model) => {
      const params = estimateModelParams(model);
      if (!params || params > max) return null;
      const quant = getBestQuant(params, ramGb, vramGb);
      const bpp =
        QUANTIZATION_TYPES.find((q) => q.id === quant)?.bytesPerParam ?? 2;
      const estimatedVram = params * bpp * 1.2;
      const status = quickCompatCheck(params, quant, ramGb, vramGb);
      if (status === "red") return null;
      const speed = estimateSpeed(
        params,
        bpp,
        !!vramGb && vramGb > 2,
        vramGb ?? 0,
      );
      return {
        model,
        recommendedQuant: quant,
        estimatedVram,
        estimatedSpeed: speed,
        compatStatus: status as ModelRecommendation["compatStatus"],
        reason: `${params.toFixed(1)}B params • ${quant.toUpperCase()} • ~${estimatedVram.toFixed(1)}GB`,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.model.downloads - a.model.downloads)
    .slice(0, 6) as ModelRecommendation[];
}

export function useRecommendations() {
  const { data: tierInfo } = useTier();
  const { data: sysInfo } = useSystemInfo();

  return useQuery({
    queryKey: ["recommendations", tierInfo?.tier, sysInfo?.ram_total_gb],
    queryFn: async () => {
      if (!tierInfo || !sysInfo) throw new Error("No tier/sys info");
      const results: Record<string, ModelRecommendation[]> = {};

      for (const task of RECOMMEND_TASKS) {
        try {
          const models = await hfApi.searchModels({
            filter: task.id,
            sort: "downloads",
            direction: "-1",
            limit: 30,
            full: true,
          });
          results[task.id] = filterByTier(
            models,
            tierInfo.tier,
            sysInfo.ram_total_gb,
            sysInfo.gpu_vram_gb,
          );
        } catch {
          results[task.id] = [];
        }
      }
      return results;
    },
    enabled: !!tierInfo && !!sysInfo,
    staleTime: 5 * 60 * 1000,
  });
}
