import type { HFModel, CompatStatus } from "./hf-types";
import { QUANTIZATION_TYPES } from "./constants";

export function estimateModelParams(model: HFModel): number | null {
  // Try safetensors metadata
  if (model.safetensors?.total) {
    return model.safetensors.total / 1e9;
  }
  if (model.safetensors?.parameters) {
    const total = Object.values(model.safetensors.parameters).reduce(
      (a, b) => a + b,
      0,
    );
    if (total > 0) return total / 1e9;
  }

  // Try to extract from model name (e.g., "llama-3-8b", "mistral-7b")
  const nameMatch = model.id.match(/(\d+(?:\.\d+)?)\s*[bB]/);
  if (nameMatch) return parseFloat(nameMatch[1]);

  // Try tags
  for (const tag of model.tags) {
    const tagMatch = tag.match(/(\d+(?:\.\d+)?)\s*[bB]/);
    if (tagMatch) return parseFloat(tagMatch[1]);
  }

  return null;
}

export function detectQuantization(model: HFModel): string {
  const id = model.id.toLowerCase();
  const tags = model.tags.map((t) => t.toLowerCase());

  // Check for GGUF quantization markers
  for (const q of QUANTIZATION_TYPES) {
    if (
      id.includes(q.id.toLowerCase()) ||
      tags.some((t) => t.includes(q.id.toLowerCase()))
    ) {
      return q.id;
    }
  }

  // Default based on library
  if (tags.includes("gguf")) return "q4_k_m";
  return "fp16";
}

export function quickCompatCheck(
  params: number | null,
  quantization: string,
  ramGb: number,
  vramGb: number | null,
): CompatStatus {
  if (!params) return "unknown";

  const bytesPerParam =
    QUANTIZATION_TYPES.find((q) => q.id === quantization)?.bytesPerParam ?? 2;
  const modelSizeGb = params * bytesPerParam;
  const neededGb = modelSizeGb * 1.2;

  if (vramGb && vramGb >= neededGb) return "green";
  if (ramGb >= neededGb * 1.1) return "yellow";
  return "red";
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return String(num);
}
