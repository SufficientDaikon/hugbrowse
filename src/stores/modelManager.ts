import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Status of a loaded model instance. */
export type ModelStatus = "loading" | "ready" | "error" | "unloading";

/** How the model was loaded — determines eviction eligibility. */
export type LoadSource = "explicit" | "jit";

/** Options for loading a model. */
export interface LoadOptions {
  gpu?: string;
  contextLength?: number;
  identifier?: string;
  ttl?: number;
  gpuDevice?: number;
}

/** A loaded model instance with runtime metadata. */
export interface LoadedModel {
  instanceId: string;
  modelPath: string;
  modelName: string;
  identifier: string;
  status: ModelStatus;
  loadedAt: number;
  lastUsedAt: number;
  vramUsageMb: number;
  ramUsageMb: number;
  contextLength: number;
  gpuOffload: string;
  port: number;
  ttlSeconds: number;
  requestCount: number;
  loadSource: LoadSource;
  healthRetries: number;
  error?: string;
}

/** Memory information for the system. */
export interface MemoryInfo {
  totalRamMb: number;
  availableRamMb: number;
  totalVramMb?: number;
  availableVramMb?: number;
  modelsRamMb: number;
  modelsVramMb: number;
}

/** Model manager configuration. */
export interface ModelManagerConfig {
  defaultGpu: string;
  defaultContextLength: number;
  defaultTtlSeconds: number;
  autoEvict: boolean;
  jitLoading: boolean;
  maxHealthRetries: number;
}

interface ModelManagerStore {
  /** All loaded model instances. */
  loadedModels: LoadedModel[];
  /** System memory info. */
  memoryInfo: MemoryInfo | null;
  /** Whether a load operation is in progress. */
  isLoading: boolean;
  /** Last error message. */
  lastError: string | null;

  /** Load a model with options. Returns the loaded model instance. */
  loadModel: (
    modelPath: string,
    modelName: string,
    options?: LoadOptions
  ) => Promise<LoadedModel | null>;

  /** Unload a specific model instance. */
  unloadModel: (instanceId: string) => Promise<void>;

  /** Unload all loaded models. */
  unloadAll: () => Promise<void>;

  /** Refresh the list of loaded models from backend. */
  refreshModels: () => Promise<void>;

  /** Refresh system memory usage. */
  refreshMemory: () => Promise<void>;

  /** Get model by instance ID. */
  getModel: (instanceId: string) => LoadedModel | undefined;

  /** Get model by identifier (API name). */
  getModelByIdentifier: (identifier: string) => LoadedModel | undefined;

  /** Initialize event listeners for model status changes. */
  initListeners: () => Promise<void>;
}

export const useModelManager = create<ModelManagerStore>()((set, get) => ({
  loadedModels: [],
  memoryInfo: null,
  isLoading: false,
  lastError: null,

  loadModel: async (modelPath, modelName, options) => {
    set({ isLoading: true, lastError: null });
    try {
      const model = await invoke<LoadedModel>("mm_load_model", {
        modelPath,
        modelName,
        options: options ?? null,
      });
      // Refresh full list to stay in sync
      await get().refreshModels();
      await get().refreshMemory();
      set({ isLoading: false });
      return model;
    } catch (e) {
      set({ isLoading: false, lastError: String(e) });
      return null;
    }
  },

  unloadModel: async (instanceId) => {
    try {
      await invoke("mm_unload_model", { instanceId });
      await get().refreshModels();
      await get().refreshMemory();
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  unloadAll: async () => {
    try {
      await invoke("mm_unload_all");
      set({ loadedModels: [] });
      await get().refreshMemory();
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  refreshModels: async () => {
    try {
      const models = await invoke<LoadedModel[]>("mm_list_loaded_models");
      set({ loadedModels: models });
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  refreshMemory: async () => {
    try {
      const info = await invoke<MemoryInfo>("mm_get_memory_usage");
      set({ memoryInfo: info });
    } catch {
      // Silently fail — memory info is non-critical
    }
  },

  getModel: (instanceId) =>
    get().loadedModels.find((m) => m.instanceId === instanceId),

  getModelByIdentifier: (identifier) =>
    get().loadedModels.find((m) => m.identifier === identifier),

  initListeners: async () => {
    await listen<{ instanceId: string; status: string; error?: string }>(
      "model-status-changed",
      (event) => {
        const { instanceId, status, error } = event.payload;
        set((state) => ({
          loadedModels: state.loadedModels.map((m) =>
            m.instanceId === instanceId
              ? {
                  ...m,
                  status: status as ModelStatus,
                  error: error ?? m.error,
                }
              : m
          ),
        }));
      }
    );

    await listen<{ instanceId: string }>("model-ttl-expired", (event) => {
      set((state) => ({
        loadedModels: state.loadedModels.filter(
          (m) => m.instanceId !== event.payload.instanceId
        ),
      }));
    });
  },
}));
