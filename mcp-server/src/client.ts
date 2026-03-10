/**
 * HugBrowse HTTP client — communicates with the embedded API server.
 * Default: http://127.0.0.1:8080
 */

const API_BASE = process.env.HUGBROWSE_API_URL ?? "http://127.0.0.1:8080";
const HF_API_BASE = "https://huggingface.co/api";
const API_KEY = process.env.HUGBROWSE_API_KEY ?? "";

// ── Generic HTTP helpers ────────────────────────────────────────────

async function request<T>(
  url: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extraHeaders,
  };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ── HugBrowse API (local axum server) ───────────────────────────────

export async function apiGetStatus(): Promise<Record<string, unknown>> {
  return request(`${API_BASE}/api/v1/status`);
}

export interface ApiModel {
  id: string;
  object: string;
  owned_by: string;
}

export async function apiListModels(): Promise<{ data: ApiModel[] }> {
  return request(`${API_BASE}/v1/models`);
}

export interface LoadModelRequest {
  model_path: string;
  model_name: string;
  ctx_size?: number;
  n_gpu_layers?: number;
  port?: number;
  ttl_seconds?: number;
}

export async function apiLoadModel(req: LoadModelRequest): Promise<Record<string, unknown>> {
  // Map to the Rust API's NativeLoadRequest schema which expects "model" field
  const payload: Record<string, unknown> = {
    model: req.model_path,
    identifier: req.model_name,
    context_length: req.ctx_size,
    gpu: req.n_gpu_layers != null ? (req.n_gpu_layers === -1 ? 1.0 : req.n_gpu_layers === 0 ? 0.0 : undefined) : undefined,
    ttl: req.ttl_seconds,
  };
  return request(`${API_BASE}/api/v1/models/load`, "POST", payload);
}

export async function apiUnloadModel(instance_id: string): Promise<Record<string, unknown>> {
  return request(`${API_BASE}/api/v1/models/unload`, "POST", { instanceId: instance_id });
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatChoice {
  index: number;
  message: { role: string; content: string };
  finish_reason: string;
}

export interface ChatResponse {
  id: string;
  choices: ChatChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function apiChat(req: ChatRequest): Promise<ChatResponse> {
  return request(`${API_BASE}/v1/chat/completions`, "POST", { ...req, stream: false });
}

export async function apiNativeChat(messages: ChatMessage[], model?: string): Promise<Record<string, unknown>> {
  return request(`${API_BASE}/api/v1/chat`, "POST", { messages, model });
}

// ── Hugging Face API (direct) ────────────────────────────────────────

const HF_TOKEN = process.env.HF_TOKEN ?? "";

function hfHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (HF_TOKEN) h["Authorization"] = `Bearer ${HF_TOKEN}`;
  return h;
}

export interface HFModel {
  _id: string;
  id: string;
  modelId: string;
  author?: string;
  pipeline_tag?: string;
  tags: string[];
  downloads: number;
  likes: number;
  library_name?: string;
  lastModified?: string;
  private: boolean;
}

export async function hfSearchModels(
  query: string,
  filter?: string,
  sort?: string,
  limit = 20,
  offset = 0,
): Promise<HFModel[]> {
  const params = new URLSearchParams();
  if (query) params.set("search", query);
  if (filter) params.set("filter", filter);
  if (sort) params.set("sort", sort);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("full", "false");
  params.set("config", "false");
  return request(`${HF_API_BASE}/models?${params}`, "GET", undefined, hfHeaders());
}

export interface HFModelFile {
  rfilename?: string;
  path?: string;
  size?: number;
  lfs?: { size: number; sha256: string; pointerSize: number };
}

export async function hfGetModelFiles(modelId: string): Promise<HFModelFile[]> {
  return request(`${HF_API_BASE}/models/${modelId}/tree/main`, "GET", undefined, hfHeaders());
}

export interface HFModelDetail extends HFModel {
  siblings?: HFModelFile[];
  cardData?: Record<string, unknown>;
  config?: Record<string, unknown>;
  safetensors?: { parameters?: Record<string, number>; total?: number };
}

export async function hfGetModelDetail(modelId: string): Promise<HFModelDetail> {
  return request(`${HF_API_BASE}/models/${modelId}`, "GET", undefined, hfHeaders());
}

export async function hfGetModelReadme(modelId: string): Promise<string> {
  const res = await fetch(`https://huggingface.co/${modelId}/raw/main/README.md`, {
    headers: hfHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return "(No README available)";
  return res.text();
}
