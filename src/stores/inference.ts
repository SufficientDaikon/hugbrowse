import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "./settings";
import { useBackends } from "./backends";

export type InferenceStatus = "unloaded" | "loading" | "running" | "error";

export interface InferenceInfo {
  status: InferenceStatus;
  model_path?: string;
  model_name?: string;
  port: number;
  ctx_size: number;
  n_gpu_layers: number;
  gpu_device?: number;
  error?: string;
}

interface InferenceStore {
  info: InferenceInfo;
  gpus: GpuInfo[];
  memoryWarning: string | null;
  load: (params: {
    modelPath: string;
    modelName: string;
    port?: number;
    ctxSize?: number;
    nGpuLayers?: number;
    gpuDevice?: number;
  }) => Promise<void>;
  unload: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchGpus: () => Promise<void>;
  checkMemory: (modelPath: string) => Promise<boolean>;
  verifySidecar: () => Promise<boolean>;
  checkApiReady: () => Promise<boolean>;
}

export interface GpuInfo {
  id: number;
  name: string;
  vendor: string;
  vram_mb: number | null;
}

const DEFAULT: InferenceInfo = {
  status: "unloaded",
  port: 11434,
  ctx_size: 4096,
  n_gpu_layers: -1,
};

export const useInference = create<InferenceStore>()((set) => ({
  info: DEFAULT,
  gpus: [],
  memoryWarning: null,

  load: async ({ modelPath, modelName, port, ctxSize, nGpuLayers, gpuDevice }) => {
    set((s) => ({ info: { ...s.info, status: "loading" }, memoryWarning: null }));
    try {
      const info = await invoke<InferenceInfo>("load_model", {
        modelPath,
        modelName,
        port: port ?? null,
        ctxSize: ctxSize ?? null,
        nGpuLayers: nGpuLayers ?? null,
        gpuDevice: gpuDevice ?? null,
      });
      set({ info });
      // FR-032: Remember last loaded model for auto-start
      useSettings.getState().setLastModelPath(modelPath);
      
      // Sync with backends store - refresh local sidecar status
      await useBackends.getState().fetchBackends();
    } catch (e) {
      // EC-001: Surface model loading errors (corrupted GGUF, etc.)
      const errorMsg = String(e);
      const isCorrupted = /invalid|corrupt|unsupported|bad magic/i.test(errorMsg);
      set((s) => ({
        info: {
          ...s.info,
          status: "error",
          error: isCorrupted
            ? `Model file appears corrupted: ${errorMsg}. Try re-downloading.`
            : errorMsg,
        },
      }));
    }
  },

  unload: async () => {
    const info = await invoke<InferenceInfo>("unload_model");
    set({ info });
    
    // Sync with backends store - refresh local sidecar status
    await useBackends.getState().fetchBackends();
  },

  refresh: async () => {
    const info = await invoke<InferenceInfo>("get_inference_status");
    set({ info });
  },

  /** EC-007: Fetch available GPUs */
  fetchGpus: async () => {
    try {
      const gpus = await invoke<GpuInfo[]>("get_gpus");
      set({ gpus });
    } catch {
      set({ gpus: [] });
    }
  },

  /** NFR-004: Check if model fits in available memory */
  checkMemory: async (modelPath: string) => {
    try {
      const [fits, msg] = await invoke<[boolean, string]>("check_model_memory", {
        modelPath,
      });
      set({ memoryWarning: fits ? null : msg });
      return fits;
    } catch {
      return true; // Assume OK if check fails
    }
  },

  /** FR-020 + EC-003: Verify sidecar binary integrity */
  verifySidecar: async () => {
    try {
      return await invoke<boolean>("verify_sidecar_checksum");
    } catch {
      return false;
    }
  },

  /** FR-031: Check if API is ready (503 if no model) */
  checkApiReady: async () => {
    try {
      return await invoke<boolean>("check_api_ready");
    } catch {
      return false;
    }
  },
}));
