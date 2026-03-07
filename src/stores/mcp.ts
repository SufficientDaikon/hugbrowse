import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  tools: McpTool[];
  lastError?: string;
}

interface McpStore {
  servers: McpServer[];
  addServer: (name: string, url: string) => void;
  removeServer: (id: string) => void;
  toggleServer: (id: string) => void;
  updateTools: (id: string, tools: McpTool[]) => void;
  setError: (id: string, error: string) => void;
  discoverTools: (id: string) => Promise<void>;
}

export const useMcp = create<McpStore>()(
  persist(
    (set, get) => ({
      servers: [],

      addServer: (name, url) =>
        set((s) => ({
          servers: [
            ...s.servers,
            { id: crypto.randomUUID(), name, url, enabled: true, tools: [] },
          ],
        })),

      removeServer: (id) =>
        set((s) => ({ servers: s.servers.filter((sv) => sv.id !== id) })),

      toggleServer: (id) =>
        set((s) => ({
          servers: s.servers.map((sv) =>
            sv.id === id ? { ...sv, enabled: !sv.enabled } : sv,
          ),
        })),

      updateTools: (id, tools) =>
        set((s) => ({
          servers: s.servers.map((sv) =>
            sv.id === id ? { ...sv, tools } : sv,
          ),
        })),

      setError: (id, error) =>
        set((s) => ({
          servers: s.servers.map((sv) =>
            sv.id === id ? { ...sv, lastError: error } : sv,
          ),
        })),

      discoverTools: async (id) => {
        const server = get().servers.find((sv) => sv.id === id);
        if (!server) return;
        try {
          const res = await fetch(`${server.url}/tools/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const data = await res.json();
          get().updateTools(id, data.tools ?? []);
        } catch (e) {
          get().setError(id, String(e));
        }
      },
    }),
    { name: "hugbrowse-mcp" },
  ),
);
