import { useQuery } from "@tanstack/react-query";
import type { SystemInfo } from "../lib/hf-types";

async function getSystemInfo(): Promise<SystemInfo> {
  // Try Tauri invoke first
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<SystemInfo>("get_system_info");
  } catch {
    // Fallback for browser dev mode
    return {
      cpu_name: "Unknown (Browser Mode)",
      cpu_cores: navigator.hardwareConcurrency || 4,
      ram_total_gb: 16,
      ram_available_gb: 8,
      gpu_name: null,
      gpu_vram_gb: null,
      os_name: navigator.platform,
      os_version: "",
    };
  }
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ["system-info"],
    queryFn: getSystemInfo,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
