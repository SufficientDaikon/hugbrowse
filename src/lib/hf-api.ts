import type {
  HFModel,
  HFModelDetail,
  HFUser,
  SearchParams,
  HFModelFile,
} from "./hf-types";
import { HF_API_BASE } from "./constants";

class HuggingFaceAPI {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private headers(): HeadersInit {
    const h: HeadersInit = { Accept: "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  async searchModels(params: SearchParams): Promise<HFModel[]> {
    const url = new URL(`${HF_API_BASE}/models`);
    if (params.search) url.searchParams.set("search", params.search);
    if (params.filter) url.searchParams.set("filter", params.filter);
    if (params.sort) url.searchParams.set("sort", params.sort);
    if (params.direction) url.searchParams.set("direction", params.direction);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.full) url.searchParams.set("full", "true");
    if (params.config) url.searchParams.set("config", "true");
    if (params.library) url.searchParams.set("filter", params.library);

    const res = await fetch(url.toString(), { headers: this.headers() });
    if (!res.ok)
      throw new Error(`HF API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getModel(modelId: string): Promise<HFModelDetail> {
    const res = await fetch(`${HF_API_BASE}/models/${modelId}`, {
      headers: this.headers(),
    });
    if (!res.ok)
      throw new Error(`HF API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getModelFiles(
    modelId: string,
    revision = "main",
  ): Promise<HFModelFile[]> {
    const res = await fetch(
      `${HF_API_BASE}/models/${modelId}/tree/${revision}`,
      { headers: this.headers() },
    );
    if (!res.ok)
      throw new Error(`HF API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getModelReadme(modelId: string): Promise<string> {
    const res = await fetch(
      `https://huggingface.co/${modelId}/raw/main/README.md`,
      { headers: this.headers() },
    );
    if (!res.ok) return "";
    return res.text();
  }

  async validateToken(): Promise<HFUser | null> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${HF_API_BASE}/whoami`, {
        headers: this.headers(),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }
}

export const hfApi = new HuggingFaceAPI();
