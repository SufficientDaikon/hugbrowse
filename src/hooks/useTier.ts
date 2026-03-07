import { useQuery } from "@tanstack/react-query";
import { useSystemInfo } from "./useSystemInfo";
import { useSettings } from "../stores/settings";
import type { TierInfo, HardwareTier } from "../lib/hf-types";

function classifyTier(
  ramGb: number,
  vramGb: number | null,
  _cpuCores: number,
): TierInfo {
  const vram = vramGb ?? 0;
  let tier: HardwareTier;
  if (ramGb <= 4) tier = "potato";
  else if (ramGb <= 16 && vram <= 4) tier = "laptop";
  else if (ramGb <= 32 && vram <= 12) tier = "gaming";
  else if (ramGb <= 64 && vram <= 24) tier = "workstation";
  else tier = "server";

  const tiers: Record<HardwareTier, Omit<TierInfo, "tier">> = {
    potato: {
      icon: "🥔",
      name: "Budget PC",
      description: "Limited to small models (1-3B) with heavy quantization",
      maxModelParams: 3,
      bestQuant: "q2_k",
      canGPU: false,
    },
    laptop: {
      icon: "💻",
      name: "Laptop",
      description:
        "Can run small models (3-7B) with quantization, CPU inference",
      maxModelParams: 7,
      bestQuant: "q4_k_m",
      canGPU: vram > 2,
    },
    gaming: {
      icon: "🎮",
      name: "Gaming PC",
      description: "Can run 7B-13B models at good speed with GPU acceleration",
      maxModelParams: 13,
      bestQuant: "q4_k_m",
      canGPU: true,
    },
    workstation: {
      icon: "🏢",
      name: "Workstation",
      description: "Can run 30B-70B models with appropriate quantization",
      maxModelParams: 70,
      bestQuant: "q4_k_m",
      canGPU: true,
    },
    server: {
      icon: "🖥️",
      name: "Server",
      description: "Enterprise tier: 70B+ models, multiple concurrent loads",
      maxModelParams: 200,
      bestQuant: "fp16",
      canGPU: true,
    },
  };

  return { tier, ...tiers[tier] };
}

export function useTier() {
  const { data: sysInfo } = useSystemInfo();
  const { tierOverride } = useSettings();

  return useQuery({
    queryKey: [
      "hardware-tier",
      sysInfo?.ram_total_gb,
      sysInfo?.gpu_vram_gb,
      sysInfo?.cpu_cores,
      tierOverride,
    ],
    queryFn: () => {
      if (!sysInfo) throw new Error("No system info");
      const detected = classifyTier(
        sysInfo.ram_total_gb,
        sysInfo.gpu_vram_gb,
        sysInfo.cpu_cores,
      );
      if (tierOverride) {
        // Re-classify with override tier
        const overridden = classifyTier(
          tierOverride === "server"
            ? 256
            : tierOverride === "workstation"
              ? 64
              : tierOverride === "gaming"
                ? 32
                : tierOverride === "laptop"
                  ? 16
                  : 4,
          tierOverride === "server"
            ? 80
            : tierOverride === "workstation"
              ? 24
              : tierOverride === "gaming"
                ? 8
                : tierOverride === "laptop"
                  ? 2
                  : 0,
          sysInfo.cpu_cores,
        );
        return {
          ...overridden,
          isOverridden: true,
          detectedTier: detected.tier,
        };
      }
      return { ...detected, isOverridden: false, detectedTier: detected.tier };
    },
    enabled: !!sysInfo,
    staleTime: Infinity,
  });
}
