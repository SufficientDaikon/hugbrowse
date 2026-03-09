import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "./settings";

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "validating"
  | "complete"
  | "failed"
  | "cancelled";

export interface DownloadEntry {
  id: string;
  model_id: string;
  filename: string;
  url: string;
  total_bytes: number;
  downloaded_bytes: number;
  status: DownloadStatus;
  error?: string;
  local_path: string;
  speed_bps: number;
  eta_secs: number;
  expected_sha256?: string;
}

interface DownloadProgress {
  id: string;
  downloaded_bytes: number;
  total_bytes: number;
  speed_bps: number;
  eta_secs: number;
  status: DownloadStatus;
  error?: string;
}

interface DownloadsStore {
  downloads: Record<string, DownloadEntry>;
  initialized: boolean;
  init: () => Promise<void>;
  startDownload: (params: {
    url: string;
    model_id: string;
    filename: string;
    dest_dir: string;
    total_bytes: number;
    expected_sha256?: string;
  }) => Promise<string>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  remove: (id: string, deleteFile?: boolean) => Promise<void>;
}

export const useDownloads = create<DownloadsStore>()((set, get) => ({
  downloads: {},
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    set({ initialized: true });
    try {
      const entries = await invoke<DownloadEntry[]>("get_downloads");
      const map: Record<string, DownloadEntry> = {};
      for (const e of entries) map[e.id] = e;
      set({ downloads: map });
    } catch {
      /* Tauri not available in browser dev */
    }
    await listen<DownloadProgress>("download-progress", (ev) => {
      const p = ev.payload;
      set((s) => ({
        downloads: {
          ...s.downloads,
          [p.id]: { ...s.downloads[p.id], ...p },
        },
      }));
    });
  },

  startDownload: async ({
    url,
    model_id,
    filename,
    dest_dir,
    total_bytes,
    expected_sha256,
  }) => {
    const authToken = useSettings.getState().hfToken ?? undefined;
    const id = await invoke<string>("start_download", {
      url,
      modelId: model_id,
      filename,
      destDir: dest_dir,
      totalBytes: total_bytes,
      expectedSha256: expected_sha256 ?? null,
      authToken: authToken ?? null,
    });
    return id;
  },

  pause: async (id) => invoke("pause_download", { id }),
  resume: async (id) => invoke("resume_download", { id }),
  cancel: async (id) => {
    await invoke("cancel_download", { id });
    set((s) => {
      const { [id]: _, ...rest } = s.downloads;
      return { downloads: rest };
    });
  },
  remove: async (id, deleteFile = false) => {
    await invoke("delete_download_entry", { id, deleteFile });
    set((s) => {
      const { [id]: _, ...rest } = s.downloads;
      return { downloads: rest };
    });
  },
}));
