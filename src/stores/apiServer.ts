import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ServerConfig {
  port: number;
  host: string;
  corsEnabled: boolean;
  corsOrigins: string[];
  authRequired: boolean;
  jitLoadingEnabled: boolean;
  defaultTtlSeconds: number;
  autoEvictEnabled: boolean;
  maxConcurrentRequests: number;
  requestLogging: boolean;
}

export interface RequestLogEntry {
  id: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  timestamp: number;
  model: string | null;
}

interface ApiServerState {
  running: boolean;
  port: number;
  host: string;
  config: ServerConfig;
  requestLog: RequestLogEntry[];

  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  updateConfig: (config: ServerConfig) => Promise<void>;
  initListeners: () => () => void;
}

const defaultConfig: ServerConfig = {
  port: 8080,
  host: "127.0.0.1",
  corsEnabled: true,
  corsOrigins: ["*"],
  authRequired: false,
  jitLoadingEnabled: true,
  defaultTtlSeconds: 3600,
  autoEvictEnabled: true,
  maxConcurrentRequests: 10,
  requestLogging: true,
};

export const useApiServer = create<ApiServerState>((set, get) => ({
  running: false,
  port: 8080,
  host: "127.0.0.1",
  config: defaultConfig,
  requestLog: [],

  startServer: async () => {
    try {
      await invoke("api_server_start");
      set({ running: true });
    } catch (e) {
      console.error("Failed to start API server:", e);
      throw e;
    }
  },

  stopServer: async () => {
    try {
      await invoke("api_server_stop");
      set({ running: false });
    } catch (e) {
      console.error("Failed to stop API server:", e);
      throw e;
    }
  },

  refreshStatus: async () => {
    try {
      const status = await invoke<{ running: boolean; port: number; host: string }>(
        "api_server_status"
      );
      set({ running: status.running, port: status.port, host: status.host });
    } catch {
      // Tauri not available (tests/browser)
    }
  },

  updateConfig: async (config: ServerConfig) => {
    try {
      await invoke("api_server_update_config", { config });
      set({ config, port: config.port, host: config.host });
    } catch (e) {
      console.error("Failed to update API server config:", e);
      throw e;
    }
  },

  initListeners: () => {
    const unlisten: (() => void)[] = [];

    listen<{ running: boolean; port: number; host?: string }>(
      "api-server-status",
      (event) => {
        set({
          running: event.payload.running,
          port: event.payload.port,
          host: event.payload.host ?? get().host,
        });
      }
    ).then((fn) => unlisten.push(fn));

    listen<RequestLogEntry>("api-request-logged", (event) => {
      set((state) => ({
        requestLog: [...state.requestLog.slice(-199), event.payload],
      }));
    }).then((fn) => unlisten.push(fn));

    return () => {
      unlisten.forEach((fn) => fn());
    };
  },
}));
