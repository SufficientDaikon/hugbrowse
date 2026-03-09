import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// Types matching Rust structs
export type BackendType = "local_sidecar" | "hf_endpoint" | "custom_url";
export type BackendStatus =
  | "online"
  | "offline"
  | "deploying"
  | "paused"
  | "error"
  | "auth_error"
  | "no_model_loaded";

export interface ComputeBackend {
  id: string;
  name: string;
  backend_type: BackendType;
  url: string | null;
  status: BackendStatus;
  latency_ms: number | null;
  model_name: string | null;
  cost_per_token: number | null;
  is_active: boolean;
}

export interface ConnectionTestResult {
  online: boolean;
  latency_ms: number | null;
  model_name: string | null;
  error: string | null;
}

interface BackendStore {
  backends: ComputeBackend[];
  activeBackend: ComputeBackend | null;
  isLoading: boolean;

  // Actions
  fetchBackends: () => Promise<void>;
  addBackend: (
    name: string,
    url: string,
    apiKey?: string,
    backendType?: BackendType,
  ) => Promise<ComputeBackend>;
  removeBackend: (id: string) => Promise<void>;
  setActiveBackend: (id: string) => Promise<void>;
  testConnection: (
    url: string,
    apiKey?: string,
  ) => Promise<ConnectionTestResult>;
  saveCredential: (backendId: string, apiKey: string) => Promise<void>;
}

export const useBackends = create<BackendStore>()((set, get) => ({
  backends: [],
  activeBackend: null,
  isLoading: false,

  fetchBackends: async () => {
    set({ isLoading: true });
    try {
      const backends = await invoke<ComputeBackend[]>("get_backends");
      const activeBackend = await invoke<ComputeBackend | null>(
        "get_active_backend",
      );
      set({ backends, activeBackend, isLoading: false });
    } catch (error) {
      console.error("Failed to fetch backends:", error);
      set({ isLoading: false });
    }
  },

  addBackend: async (name, url, apiKey, backendType = "custom_url") => {
    try {
      const backend = await invoke<ComputeBackend>("add_backend", {
        name,
        url,
        apiKey: apiKey ?? null,
        backendType: backendType,
      });

      set((state) => ({
        backends: [...state.backends, backend],
      }));

      return backend;
    } catch (error) {
      console.error("Failed to add backend:", error);
      throw error;
    }
  },

  removeBackend: async (id) => {
    try {
      await invoke("remove_backend", { id });
      set((state) => ({
        backends: state.backends.filter((b) => b.id !== id),
        activeBackend:
          state.activeBackend?.id === id ? null : state.activeBackend,
      }));
    } catch (error) {
      console.error("Failed to remove backend:", error);
      throw error;
    }
  },

  setActiveBackend: async (id) => {
    try {
      await invoke("set_active_backend", { id });
      const activeBackend = get().backends.find((b) => b.id === id) ?? null;
      set({ activeBackend });
    } catch (error) {
      console.error("Failed to set active backend:", error);
      throw error;
    }
  },

  testConnection: async (url, apiKey) => {
    try {
      const result = await invoke<ConnectionTestResult>(
        "test_backend_connection",
        {
          url,
          apiKey: apiKey ?? null,
        },
      );
      return result;
    } catch (error) {
      console.error("Failed to test connection:", error);
      return {
        online: false,
        latency_ms: null,
        model_name: null,
        error: String(error),
      };
    }
  },

  saveCredential: async (backendId, apiKey) => {
    try {
      await invoke("save_backend_credential", {
        backendId,
        apiKey,
      });
    } catch (error) {
      console.error("Failed to save credential:", error);
      throw error;
    }
  },
}));

// Initialize store by fetching backends on creation
useBackends.getState().fetchBackends();
