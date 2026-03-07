export const HF_API_BASE = "https://huggingface.co/api";
export const HF_BASE = "https://huggingface.co";

export const TASK_CATEGORIES = [
  { id: "text-generation", label: "Text Generation", icon: "💬" },
  { id: "text-to-image", label: "Text to Image", icon: "🎨" },
  { id: "image-classification", label: "Image Classification", icon: "🖼️" },
  { id: "text-classification", label: "Text Classification", icon: "📝" },
  { id: "token-classification", label: "Token Classification", icon: "🏷️" },
  { id: "translation", label: "Translation", icon: "🌐" },
  { id: "summarization", label: "Summarization", icon: "📋" },
  { id: "question-answering", label: "Question Answering", icon: "❓" },
  { id: "fill-mask", label: "Fill Mask", icon: "🎭" },
  {
    id: "automatic-speech-recognition",
    label: "Speech Recognition",
    icon: "🎤",
  },
  { id: "text-to-speech", label: "Text to Speech", icon: "🔊" },
  { id: "object-detection", label: "Object Detection", icon: "🔍" },
  { id: "image-to-text", label: "Image to Text", icon: "📸" },
  { id: "feature-extraction", label: "Feature Extraction", icon: "🧬" },
  { id: "sentence-similarity", label: "Sentence Similarity", icon: "🔗" },
] as const;

export const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "downloads", label: "Most Downloads" },
  { value: "likes", label: "Most Likes" },
  { value: "lastModified", label: "Recently Updated" },
] as const;

export const LIBRARY_FILTERS = [
  "transformers",
  "diffusers",
  "gguf",
  "pytorch",
  "tensorflow",
  "jax",
  "safetensors",
  "onnx",
  "mlx",
] as const;

export const QUANTIZATION_TYPES = [
  { id: "fp32", label: "FP32 (Full)", bytesPerParam: 4 },
  { id: "fp16", label: "FP16 (Half)", bytesPerParam: 2 },
  { id: "q8_0", label: "Q8 (8-bit)", bytesPerParam: 1 },
  { id: "q6_k", label: "Q6_K", bytesPerParam: 0.75 },
  { id: "q5_k_m", label: "Q5_K_M", bytesPerParam: 0.625 },
  { id: "q4_k_m", label: "Q4_K_M", bytesPerParam: 0.5 },
  { id: "q3_k_m", label: "Q3_K_M", bytesPerParam: 0.375 },
  { id: "q2_k", label: "Q2_K", bytesPerParam: 0.25 },
] as const;

// V2: Hardware tier definitions
export const TIER_INFO = {
  potato: {
    icon: "🥔",
    name: "Budget PC",
    description: "Limited to small models (1-3B) with heavy quantization",
    maxParams: 3,
    color: "text-orange-600",
  },
  laptop: {
    icon: "💻",
    name: "Laptop",
    description: "Can run small models (3-7B) with quantization, CPU inference",
    maxParams: 7,
    color: "text-blue-500",
  },
  gaming: {
    icon: "🎮",
    name: "Gaming PC",
    description: "Can run 7B-13B models at good speed with GPU acceleration",
    maxParams: 13,
    color: "text-green-500",
  },
  workstation: {
    icon: "🏢",
    name: "Workstation",
    description: "Can run 30B-70B models with appropriate quantization",
    maxParams: 70,
    color: "text-purple-500",
  },
  server: {
    icon: "🖥️",
    name: "Server",
    description: "Enterprise tier: 70B+ models, multiple concurrent loads",
    maxParams: 200,
    color: "text-red-500",
  },
} as const;

// V2: Quality star ratings per quantization
export const QUANT_QUALITY: Record<string, 1 | 2 | 3 | 4 | 5> = {
  fp32: 5,
  fp16: 5,
  q8_0: 4,
  q6_k: 4,
  q5_k_m: 3,
  q4_k_m: 3,
  q3_k_m: 2,
  q2_k: 1,
};

// V2: Speed estimation lookup — (paramsB, quantBytesPerParam, hasGPU) → bracket
export type SpeedBracket = "fast" | "good" | "usable" | "slow";
export function estimateSpeed(
  paramsB: number,
  bytesPerParam: number,
  hasGPU: boolean,
  vramGb: number,
): SpeedBracket {
  const sizeGb = paramsB * bytesPerParam;
  if (hasGPU && vramGb >= sizeGb * 1.2) {
    if (paramsB <= 3) return "fast";
    if (paramsB <= 7) return "good";
    if (paramsB <= 13) return "usable";
    return "slow";
  }
  // CPU inference
  if (paramsB <= 1.5 && bytesPerParam <= 0.5) return "good";
  if (paramsB <= 3 && bytesPerParam <= 0.5) return "usable";
  if (paramsB <= 7 && bytesPerParam <= 0.5) return "usable";
  return "slow";
}

export const SPEED_LABELS: Record<
  SpeedBracket,
  { label: string; color: string }
> = {
  fast: { label: ">30 tok/s", color: "text-green-500" },
  good: { label: "15-30 tok/s", color: "text-blue-500" },
  usable: { label: "5-15 tok/s", color: "text-yellow-500" },
  slow: { label: "<5 tok/s", color: "text-red-500" },
};

// V2: Default alert thresholds
export const DEFAULT_ALERT_THRESHOLDS = {
  ram: 85,
  vram: 90,
  cpu: 95,
};

// V2: Recommended tasks for the recommendations page
export const RECOMMEND_TASKS = [
  { id: "text-generation", label: "Text Generation", icon: "💬" },
  { id: "text-to-image", label: "Image Generation", icon: "🎨" },
  { id: "text2text-generation", label: "Code & Translation", icon: "💻" },
  { id: "automatic-speech-recognition", label: "Speech & Audio", icon: "🎤" },
] as const;
