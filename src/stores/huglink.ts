import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface HugLinkDevice {
  id: string;
  name: string;
  address: string;
  isOnline: boolean;
  lastSeen: string;
  hardware: {
    gpu: string;
    vramMb: number;
    ramMb: number;
  };
  loadedModels: string[];
  latencyMs: number;
  isPreferred: boolean;
}

interface HugLinkStatus {
  enabled: boolean;
  deviceName: string;
  connectedDevices: number;
  preferredDevice: string | null;
}

interface HugLinkStore {
  enabled: boolean;
  devices: HugLinkDevice[];
  status: HugLinkStatus | null;
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  fetchDevices: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setPreferred: (deviceId: string) => Promise<void>;
  rename: (newName: string) => Promise<void>;
}

export const useHugLinkStore = create<HugLinkStore>((set) => ({
  enabled: false,
  devices: [],
  status: null,
  loading: false,
  error: null,

  fetchStatus: async () => {
    try {
      const status = await invoke<HugLinkStatus>('huglink_status');
      set({ status, enabled: status.enabled, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  fetchDevices: async () => {
    try {
      set({ loading: true });
      const devices = await invoke<HugLinkDevice[]>('huglink_list_devices');
      set({ devices, loading: false, error: null });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  setEnabled: async (enabled: boolean) => {
    try {
      await invoke('huglink_set_enabled', { enabled });
      set({ enabled });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setPreferred: async (deviceId: string) => {
    try {
      await invoke('huglink_set_preferred', { deviceId });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  rename: async (newName: string) => {
    try {
      await invoke('huglink_rename', { newName });
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
