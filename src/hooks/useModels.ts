import { useInfiniteQuery } from "@tanstack/react-query";
import { hfApi } from "../lib/hf-api";
import { useSearchStore } from "../stores/search";

const PAGE_SIZE = 24;

export function useModels() {
  const { query, activeFilters, sort } = useSearchStore();

  const filterString =
    [...activeFilters.tasks, ...activeFilters.libraries].join(",") || undefined;

  return useInfiniteQuery({
    queryKey: ["models", query, filterString, sort],
    queryFn: async () => {
      const models = await hfApi.searchModels({
        search: query || undefined,
        filter: filterString,
        sort: sort === "trending" ? "likes7d" : sort,
        direction: "-1",
        limit: PAGE_SIZE,
        full: true,
        config: true,
      });
      return models;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
  });
}
