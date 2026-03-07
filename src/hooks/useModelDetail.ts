import { useQuery } from "@tanstack/react-query";
import { hfApi } from "../lib/hf-api";

export function useModelDetail(modelId: string) {
  return useQuery({
    queryKey: ["model", modelId],
    queryFn: () => hfApi.getModel(modelId),
    enabled: !!modelId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useModelReadme(modelId: string) {
  return useQuery({
    queryKey: ["model-readme", modelId],
    queryFn: () => hfApi.getModelReadme(modelId),
    enabled: !!modelId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useModelFiles(modelId: string) {
  return useQuery({
    queryKey: ["model-files", modelId],
    queryFn: () => hfApi.getModelFiles(modelId),
    enabled: !!modelId,
    staleTime: 10 * 60 * 1000,
  });
}
