import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ── Types ──────────────────────────────────────────────────────────────

export type ImportSource = "manual" | "ollama" | "lmstudio";
export type ImportStatus = "available" | "missing" | "loaded";

export interface ImportedModel {
  id: string;
  name: string;
  path: string;
  size: number;
  importDate: string;
  source: ImportSource;
  status: ImportStatus;
}

export interface DetectedServer {
  type: "ollama" | "lmstudio";
  status: "running" | "stopped" | "not_found";
  models: Array<{ name: string; size: number; path?: string }>;
}

/** Rust-side persisted model shape */
interface PersistedImportedModel {
  id: string;
  name: string;
  path: string;
  size: number;
  import_date: string;
  source: string;
}

/** Rust-side Ollama scan result */
interface OllamaScanResult {
  status: string;
  models: Array<{ name: string; size: number; modified_at: string }>;
}

/** Rust-side scanned GGUF file */
interface ScannedGgufFile {
  name: string;
  path: string;
  size: number;
}

/** Rust-side import result */
interface ImportedModelInfo {
  name: string;
  path: string;
  size: number;
}

// ── Store ──────────────────────────────────────────────────────────────

interface ImportsStore {
  models: ImportedModel[];
  detectedServers: DetectedServer[];
  isScanning: boolean;
  scanError: string | null;
  ollamaStarting: boolean;

  fetchImportedModels: () => Promise<void>;
  importFile: (path: string) => Promise<ImportedModel>;
  removeImport: (id: string) => Promise<void>;
  scanOllama: () => Promise<DetectedServer>;
  scanLmStudio: () => Promise<DetectedServer>;
  autoDetectAll: () => Promise<DetectedServer[]>;
  startOllama: () => Promise<string>;
}

function generateId(): string {
  return `import_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toImportedModel(p: PersistedImportedModel): ImportedModel {
  return {
    id: p.id,
    name: p.name,
    path: p.path,
    size: p.size,
    importDate: p.import_date,
    source: (p.source as ImportSource) || "manual",
    status: "available",
  };
}

function toPersistedModel(m: ImportedModel): PersistedImportedModel {
  return {
    id: m.id,
    name: m.name,
    path: m.path,
    size: m.size,
    import_date: m.importDate,
    source: m.source,
  };
}

export const useImports = create<ImportsStore>()((set, get) => ({
  models: [],
  detectedServers: [],
  isScanning: false,
  scanError: null,
  ollamaStarting: false,

  fetchImportedModels: async () => {
    try {
      const persisted = await invoke<PersistedImportedModel[]>(
        "get_imported_models",
      );
      set({ models: persisted.map(toImportedModel) });
    } catch {
      // Tauri not available (browser dev mode)
    }
  },

  importFile: async (path: string) => {
    const info = await invoke<ImportedModelInfo>("import_model_file", {
      filePath: path,
    });

    const newModel: ImportedModel = {
      id: generateId(),
      name: info.name,
      path: info.path,
      size: info.size,
      importDate: new Date().toISOString(),
      source: "manual",
      status: "available",
    };

    const updated = [...get().models, newModel];
    set({ models: updated });

    // Persist to backend
    try {
      await invoke("save_imported_models", {
        models: updated.map(toPersistedModel),
      });
    } catch {
      // Best effort persistence
    }

    return newModel;
  },

  removeImport: async (id: string) => {
    const updated = get().models.filter((m) => m.id !== id);
    set({ models: updated });

    // FR-017: Remove from list, do NOT delete the file
    try {
      await invoke("save_imported_models", {
        models: updated.map(toPersistedModel),
      });
    } catch {
      // Best effort persistence
    }
  },

  scanOllama: async () => {
    const result = await invoke<OllamaScanResult>("scan_ollama_models");

    const server: DetectedServer = {
      type: "ollama",
      status: result.status === "running" ? "running" : "stopped",
      models: result.models.map((m) => ({
        name: m.name,
        size: m.size,
      })),
    };

    return server;
  },

  scanLmStudio: async () => {
    const files = await invoke<ScannedGgufFile[]>("scan_lm_studio_models");

    const server: DetectedServer = {
      type: "lmstudio",
      status: files.length > 0 ? "running" : "not_found",
      models: files.map((f) => ({
        name: f.name,
        size: f.size,
        path: f.path,
      })),
    };

    return server;
  },

  autoDetectAll: async () => {
    set({ isScanning: true, scanError: null });
    try {
      const [ollama, lmStudio] = await Promise.all([
        get().scanOllama(),
        get().scanLmStudio(),
      ]);

      const servers = [ollama, lmStudio];
      set({ detectedServers: servers, isScanning: false });
      return servers;
    } catch (e) {
      set({ isScanning: false, scanError: String(e) });
      return [];
    }
  },

  startOllama: async () => {
    set({ ollamaStarting: true });
    try {
      const result = await invoke<string>("start_ollama");
      set({ ollamaStarting: false });
      // Re-scan to update server status
      if (result === "started" || result === "already_running") {
        const ollama = await get().scanOllama();
        set((s) => ({
          detectedServers: s.detectedServers.map((ds) =>
            ds.type === "ollama" ? ollama : ds,
          ),
        }));
      }
      return result;
    } catch (e) {
      set({ ollamaStarting: false });
      throw e;
    }
  },
}));
