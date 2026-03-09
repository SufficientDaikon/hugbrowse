import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  general: {
    language: string;
    autoUpdate: boolean;
    telemetry: boolean;
    startMinimized: boolean;
    closeToTray: boolean;
  };
  models: {
    defaultGpu: number | string;
    defaultContextLength: number;
    defaultTtlSeconds: number;
    autoEvict: boolean;
    jitLoading: boolean;
    modelsDirectory: string;
  };
  server: {
    port: number;
    host: string;
    corsOrigins: string[];
    autoStart: boolean;
  };
  appearance: {
    theme: string;
    fontSize: number;
    fontFamily: string;
    sidebarWidth: number;
  };
  downloads: {
    maxConcurrent: number;
    bandwidthLimitKbps: number;
    autoResume: boolean;
  };
  advanced: {
    logLevel: string;
    experimentalFeatures: boolean;
  };
}

interface ConfigStore {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  exportSettings: () => Promise<string>;
  importSettings: (json: string) => Promise<void>;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  settings: null,
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await invoke<AppSettings>("config_get_settings");
      set({ settings, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  updateSettings: async (settings) => {
    await invoke("config_update_settings", { settings });
    set({ settings });
  },

  exportSettings: async () => {
    return invoke<string>("config_export_settings");
  },

  importSettings: async (json) => {
    const settings = await invoke<AppSettings>("config_import_settings", {
      json,
    });
    set({ settings });
  },
}));
