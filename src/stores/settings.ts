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

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      setHfToken: (token, username = null) =>
        set({ hfToken: token, hfUsername: username }),

      setDefaultSort: (sort) => set({ defaultSort: sort }),

      addSearchHistory: (query) => {
        const history = get().searchHistory.filter((q) => q !== query);
        set({ searchHistory: [query, ...history].slice(0, 10) });
      },

      clearSearchHistory: () => set({ searchHistory: [] }),

      setTierOverride: (tier) => set({ tierOverride: tier }),

      setAlertThresholds: (thresholds) => set({ alertThresholds: thresholds }),

      setOnboardingComplete: (v) => set({ onboardingComplete: v }),
    }),
    { name: "hugbrowse-settings" },
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
