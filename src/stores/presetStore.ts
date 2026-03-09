import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface InferenceParameters {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  repeatPenalty: number;
  stop: string[];
  seed: number | null;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  parameters: InferenceParameters;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
}

interface PresetStore {
  presets: Preset[];
  loading: boolean;
  error: string | null;

  fetchPresets: () => Promise<void>;
  createPreset: (
    name: string,
    description: string,
    systemPrompt: string,
    parameters: InferenceParameters
  ) => Promise<Preset>;
  updatePreset: (
    id: string,
    updates: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      parameters?: InferenceParameters;
      isDefault?: boolean;
    }
  ) => Promise<Preset>;
  deletePreset: (id: string) => Promise<void>;
  exportPreset: (id: string) => Promise<string>;
  importPreset: (json: string) => Promise<Preset>;
}

export const DEFAULT_PARAMETERS: InferenceParameters = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 2048,
  repeatPenalty: 1.1,
  stop: [],
  seed: null,
};

export const usePresetStore = create<PresetStore>((set) => ({
  presets: [],
  loading: false,
  error: null,

  fetchPresets: async () => {
    set({ loading: true, error: null });
    try {
      const presets = await invoke<Preset[]>("config_list_presets");
      set({ presets: presets ?? [], loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createPreset: async (name, description, systemPrompt, parameters) => {
    const preset = await invoke<Preset>("config_create_preset", {
      name,
      description,
      systemPrompt,
      parameters,
    });
    set((s) => ({ presets: [...s.presets, preset] }));
    return preset;
  },

  updatePreset: async (id, updates) => {
    const preset = await invoke<Preset>("config_update_preset", {
      id,
      ...updates,
    });
    set((s) => ({
      presets: s.presets.map((p) => (p.id === id ? preset : p)),
    }));
    return preset;
  },

  deletePreset: async (id) => {
    await invoke("config_delete_preset", { id });
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
  },

  exportPreset: async (id) => {
    return invoke<string>("config_export_preset", { id });
  },

  importPreset: async (json) => {
    const preset = await invoke<Preset>("config_import_preset", { json });
    set((s) => ({ presets: [...s.presets, preset] }));
    return preset;
  },
}));
