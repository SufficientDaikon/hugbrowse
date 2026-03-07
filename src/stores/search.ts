import { create } from "zustand";

interface SearchState {
  query: string;
  activeFilters: {
    tasks: string[];
    libraries: string[];
  };
  sort: string;
  setQuery: (query: string) => void;
  toggleTask: (task: string) => void;
  toggleLibrary: (lib: string) => void;
  setSort: (sort: string) => void;
  clearFilters: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  activeFilters: { tasks: [], libraries: [] },
  sort: "trending",

  setQuery: (query) => set({ query }),

  toggleTask: (task) => {
    const tasks = get().activeFilters.tasks;
    set({
      activeFilters: {
        ...get().activeFilters,
        tasks: tasks.includes(task)
          ? tasks.filter((t) => t !== task)
          : [...tasks, task],
      },
    });
  },

  toggleLibrary: (lib) => {
    const libraries = get().activeFilters.libraries;
    set({
      activeFilters: {
        ...get().activeFilters,
        libraries: libraries.includes(lib)
          ? libraries.filter((l) => l !== lib)
          : [...libraries, lib],
      },
    });
  },

  setSort: (sort) => set({ sort }),

  clearFilters: () =>
    set({ activeFilters: { tasks: [], libraries: [] }, query: "" }),
}));
