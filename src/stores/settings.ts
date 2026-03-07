import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HardwareTier } from "../lib/hf-types";

type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  hfToken: string | null;
  hfUsername: string | null;
  defaultSort: string;
  searchHistory: string[];
  tierOverride: HardwareTier | null;
  alertThresholds: { ram: number; vram: number; cpu: number };
  onboardingComplete: boolean;
  /** FR-048: Auto-load last used model on launch */
  autoLoadLastModel: boolean;
  lastModelPath: string | null;
  _tokenLoaded: boolean;
  setTheme: (theme: Theme) => void;
  setHfToken: (token: string | null, username?: string | null) => void;
  setDefaultSort: (sort: string) => void;
  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  setTierOverride: (tier: HardwareTier | null) => void;
  setAlertThresholds: (thresholds: {
    ram: number;
    vram: number;
    cpu: number;
  }) => void;
  setOnboardingComplete: (v: boolean) => void;
  setAutoLoadLastModel: (v: boolean) => void;
  setLastModelPath: (path: string | null) => void;
  loadTokenFromStore: () => Promise<void>;
}

// NFR-007: Use Tauri encrypted store for HF token instead of localStorage
async function saveTokenToSecureStore(
  token: string | null,
  username: string | null,
) {
  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("credentials.json");
    if (token) {
      await store.set("hfToken", token);
      await store.set("hfUsername", username);
    } else {
      await store.delete("hfToken");
      await store.delete("hfUsername");
    }
    await store.save();
  } catch {
    /* Tauri store not available (browser dev) */
  }
}

async function loadTokenFromSecureStore(): Promise<{
  token: string | null;
  username: string | null;
}> {
  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("credentials.json");
    const token = (await store.get<string>("hfToken")) ?? null;
    const username = (await store.get<string>("hfUsername")) ?? null;
    return { token, username };
  } catch {
    return { token: null, username: null };
  }
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "system",
      hfToken: null,
      hfUsername: null,
      defaultSort: "trending",
      searchHistory: [],
      tierOverride: null,
      alertThresholds: { ram: 85, vram: 90, cpu: 95 },
      onboardingComplete: false,
      autoLoadLastModel: false,
      lastModelPath: null,
      _tokenLoaded: false,

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      setHfToken: (token, username = null) => {
        set({ hfToken: token, hfUsername: username });
        saveTokenToSecureStore(token, username);
      },

      setDefaultSort: (sort) => set({ defaultSort: sort }),

      addSearchHistory: (query) => {
        const history = get().searchHistory.filter((q) => q !== query);
        set({ searchHistory: [query, ...history].slice(0, 10) });
      },

      clearSearchHistory: () => set({ searchHistory: [] }),

      setTierOverride: (tier) => set({ tierOverride: tier }),

      setAlertThresholds: (thresholds) => set({ alertThresholds: thresholds }),

      setOnboardingComplete: (v) => set({ onboardingComplete: v }),

      setAutoLoadLastModel: (v) => set({ autoLoadLastModel: v }),

      setLastModelPath: (path) => set({ lastModelPath: path }),

      loadTokenFromStore: async () => {
        if (get()._tokenLoaded) return;
        const { token, username } = await loadTokenFromSecureStore();
        set({ hfToken: token, hfUsername: username, _tokenLoaded: true });
      },
    }),
    {
      name: "hugbrowse-settings",
      // Exclude hfToken from localStorage persistence (stored in encrypted store)
      partialize: (s) => ({
        theme: s.theme,
        defaultSort: s.defaultSort,
        searchHistory: s.searchHistory,
        tierOverride: s.tierOverride,
        alertThresholds: s.alertThresholds,
        onboardingComplete: s.onboardingComplete,
        autoLoadLastModel: s.autoLoadLastModel,
        lastModelPath: s.lastModelPath,
      }),
    },
  ),
);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

const initialTheme = useSettings.getState().theme;
applyTheme(initialTheme);

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (useSettings.getState().theme === "system") {
      applyTheme("system");
    }
  });
