export interface HFModel {
  _id: string;
  id: string;
  modelId: string;
  author?: string;
  sha?: string;
  lastModified?: string;
  private: boolean;
  disabled: boolean;
  gated: boolean | string;
  pipeline_tag?: string;
  tags: string[];
  downloads: number;
  likes: number;
  library_name?: string;
  createdAt?: string;
  siblings?: HFModelFile[];
  config?: Record<string, unknown>;
  cardData?: Record<string, unknown>;
  safetensors?: {
    parameters?: Record<string, number>;
    total?: number;
  };
}

export interface HFModelFile {
  rfilename: string;
  size?: number;
  blobId?: string;
  lfs?: {
    size: number;
    sha256: string;
    pointerSize: number;
  };
}

export interface HFModelDetail extends HFModel {
  cardData?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface HFUser {
  type: string;
  name: string;
  fullname: string;
  email?: string;
  emailVerified?: boolean;
  plan?: string;
  avatarUrl?: string;
}

export interface SearchParams {
  search?: string;
  filter?: string;
  sort?: string;
  direction?: string;
  limit?: number;
  full?: boolean;
  config?: boolean;
  author?: string;
  library?: string;
}

export type CompatStatus = "green" | "yellow" | "red" | "unknown";

export interface CompatResult {
  status: CompatStatus;
  message: string;
  model_size_gb: number;
  needed_gb: number;
  suggestions: string[];
  system: SystemInfo;
}

export interface SystemInfo {
  cpu_name: string;
  cpu_cores: number;
  ram_total_gb: number;
  ram_available_gb: number;
  gpu_name: string | null;
  gpu_vram_gb: number | null;
  os_name: string;
  os_version: string;
}

// V2 Types

export type HardwareTier =
  | "potato"
  | "laptop"
  | "gaming"
  | "workstation"
  | "server";

export interface TierInfo {
  tier: HardwareTier;
  icon: string;
  name: string;
  description: string;
  maxModelParams: number;
  bestQuant: string;
  canGPU: boolean;
}

export interface LiveResources {
  cpu_percent: number;
  cpu_per_core: number[];
  ram_used_gb: number;
  ram_total_gb: number;
  gpu_percent: number | null;
  gpu_temp_c: number | null;
  vram_used_gb: number | null;
  vram_total_gb: number | null;
  disk_free_gb: number;
  disk_total_gb: number;
  timestamp: number;
}

export interface DiskSpaceInfo {
  total_gb: number;
  free_gb: number;
  available_gb: number;
  path: string;
}

export type SpeedBracket = "fast" | "good" | "usable" | "slow";

export interface QuantComparison {
  quant: string;
  label: string;
  sizeGb: number;
  vramNeeded: number;
  speedBracket: SpeedBracket;
  qualityStars: 1 | 2 | 3 | 4 | 5;
  compatible: boolean;
  recommended: boolean;
}

export interface ModelRecommendation {
  model: HFModel;
  recommendedQuant: string;
  estimatedVram: number;
  estimatedSpeed: SpeedBracket;
  compatStatus: CompatStatus;
  reason: string;
}

export interface ResourceAlert {
  type: "ram" | "vram" | "cpu";
  threshold: number;
  current: number;
  message: string;
}
