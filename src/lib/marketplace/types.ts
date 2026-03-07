/** Community Marketplace Types — FR-066, FR-067 */

export type ContentCategory = "models" | "plugins" | "mcp-servers" | "workflows" | "skills";

export type ListingStatus = "published" | "unpublished" | "flagged";

export interface MarketplaceListing {
  id: string;
  name: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  description: string;
  category: ContentCategory;
  tags: string[];
  version: string;
  versions: VersionEntry[];
  downloadCount: number;
  averageRating: number;
  reviewCount: number;
  license: string;
  createdAt: number;
  updatedAt: number;
  fileSize: number;
  checksum: string;
  compatibility: CompatibilityMeta;
  featured: boolean;
  status: ListingStatus;
  screenshots?: string[];
  downloadUrl: string;
}

export interface VersionEntry {
  version: string;
  releasedAt: number;
  changelog: string;
  downloadUrl: string;
  checksum: string;
  fileSize: number;
}

export interface CompatibilityMeta {
  platforms: ("windows" | "macos" | "linux")[];
  minAppVersion: string;
  pluginApiVersion?: number;
  requiredModels?: string[];
  requiredMcpTools?: string[];
  hardwareTiers?: string[];
}

export interface Review {
  id: string;
  listingId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  text: string;
  createdAt: number;
  updatedAt: number;
  flagged: boolean;
}

export interface InstalledExtension {
  id: string;
  listingId: string | null;
  name: string;
  version: string;
  category: ContentCategory;
  installPath: string;
  enabled: boolean;
  permissions: PluginPermission[];
  installedAt: number;
  lastUpdated: number;
  config: Record<string, unknown>;
  status: "active" | "disabled" | "errored";
  error?: string;
  updateAvailable?: string;
}

export type PluginPermission = "filesystem" | "network" | "model" | "chat" | "settings" | "rag";

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  entryPoint: string;
  apiVersion: number;
  permissions: PluginPermission[];
  ui?: PluginUIContribution[];
  dependencies?: { plugins?: string[]; models?: string[] };
  icon?: string;
}

export interface PluginUIContribution {
  type: "sidebar-panel" | "chat-toolbar" | "settings-tab" | "model-detail-panel";
  label: string;
  icon?: string;
  entryPoint: string;
}

export interface CreatorProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  bio: string;
  listingsCount: number;
  totalDownloads: number;
  averageRating: number;
  followersCount: number;
  joinedAt: number;
  hfProfileUrl: string;
  badges: string[];
}

export interface CommunityModel {
  id: string;
  listingId: string;
  filename: string;
  filePath: string;
  fileSize: number;
  checksum: string;
  category: "embedding" | "chat" | "code" | "other";
  quantization: string;
  parameterCount: number;
  contextLengths: number[];
  downloadDate: number;
  integrityOk: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  requiredModelTags: string[];
  requiredMcpTools: string[];
  ragConfig?: { chunkSize: number; overlap: number; topK: number };
  tags: string[];
  author: string;
}

export type MarketplaceSortOption = "trending" | "downloads" | "rating" | "newest" | "updated";

export interface RegistryIndex {
  version: number;
  updatedAt: number;
  listings: MarketplaceListing[];
}
