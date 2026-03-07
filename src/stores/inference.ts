import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "./settings";

export type InferenceStatus = "unloaded" | "loading" | "running" | "error";

export interface InferenceInfo {
  status: InferenceStatus;
  model_path?: string;
  model_name?: string;
  port: number;
  ctx_size: number;
  n_gpu_layers: number;
  error?: string;
}

interface InferenceStore {
  info: InferenceInfo;
  load: (params: {
    modelPath: string;
    modelName: string;
    port?: number;
    ctxSize?: number;
    nGpuLayers?: number;
  }) => Promise<void>;
  unload: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT: InferenceInfo = {
  status: "unloaded",
  port: 11434,
  ctx_size: 4096,
  n_gpu_layers: -1,
};

export const useInference = create<InferenceStore>()((set) => ({
  info: DEFAULT,

  load: async ({ modelPath, modelName, port, ctxSize, nGpuLayers }) => {
    set((s) => ({ info: { ...s.info, status: "loading" } }));
    try {
      const info = await invoke<InferenceInfo>("load_model", {
        model_path: modelPath,
        model_name: modelName,
        port: port ?? null,
        ctx_size: ctxSize ?? null,
        n_gpu_layers: nGpuLayers ?? null,
      });
      set({ info });
      // FR-032: Remember last loaded model for auto-start
      useSettings.getState().setLastModelPath(modelPath);
    } catch (e) {
      set((s) => ({
        info: { ...s.info, status: "error", error: String(e) },
      }));
    }
  },

  unload: async () => {
    const info = await invoke<InferenceInfo>("unload_model");
    set({ info });
  },

  refresh: async () => {
    const info = await invoke<InferenceInfo>("get_inference_status");
    set({ info });
  },
}));
