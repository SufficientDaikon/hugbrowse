import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  type: 'tool' | 'preprocessor' | 'generator' | 'ui';
  permissions: string[];
  entry: string;
  configSchema?: Record<string, unknown>;
}

interface Plugin {
  id: string;
  manifest: PluginManifest;
  status: 'installed' | 'enabled' | 'disabled' | 'error';
  installPath: string;
  config: Record<string, unknown>;
  error: string | null;
}

interface PluginStore {
  plugins: Plugin[];
  loading: boolean;
  error: string | null;
  fetchPlugins: () => Promise<void>;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  rescanPlugins: () => Promise<void>;
}

export const usePluginStore = create<PluginStore>((set) => ({
  plugins: [],
  loading: false,
  error: null,

  fetchPlugins: async () => {
    try {
      set({ loading: true });
      const plugins = await invoke<Plugin[]>('plugin_list');
      set({ plugins, loading: false, error: null });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  enablePlugin: async (pluginId: string) => {
    try {
      await invoke('plugin_enable', { pluginId });
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.id === pluginId ? { ...p, status: 'enabled' as const } : p
        ),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  disablePlugin: async (pluginId: string) => {
    try {
      await invoke('plugin_disable', { pluginId });
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.id === pluginId ? { ...p, status: 'disabled' as const } : p
        ),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  uninstallPlugin: async (pluginId: string) => {
    try {
      await invoke('plugin_uninstall', { pluginId });
      set((state) => ({
        plugins: state.plugins.filter((p) => p.id !== pluginId),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  rescanPlugins: async () => {
    try {
      set({ loading: true });
      await invoke('plugin_rescan');
      const plugins = await invoke<Plugin[]>('plugin_list');
      set({ plugins, loading: false, error: null });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },
}));
