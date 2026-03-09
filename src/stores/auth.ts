import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type Permission = "inference" | "model_management" | "server_admin" | "downloads";

export interface ApiToken {
  id: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  permissions: Permission[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  requestCount: number;
  isActive: boolean;
}

export interface AuthConfig {
  authRequired: boolean;
}

interface AuthState {
  tokens: ApiToken[];
  config: AuthConfig;
  lastCreatedPlaintext: string | null;

  refreshTokens: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  createToken: (name: string, permissions: Permission[], expiresInDays?: number) => Promise<string>;
  revokeToken: (tokenId: string) => Promise<void>;
  deleteToken: (tokenId: string) => Promise<void>;
  setConfig: (config: AuthConfig) => Promise<void>;
  clearPlaintext: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  tokens: [],
  config: { authRequired: false },
  lastCreatedPlaintext: null,

  refreshTokens: async () => {
    try {
      const tokens = await invoke<ApiToken[]>("auth_list_tokens");
      set({ tokens });
    } catch {
      // Tauri not available
    }
  },

  refreshConfig: async () => {
    try {
      const config = await invoke<AuthConfig>("auth_get_config");
      set({ config });
    } catch {
      // Tauri not available
    }
  },

  createToken: async (name, permissions, expiresInDays) => {
    const result = await invoke<{ token: ApiToken; plaintext: string }>(
      "auth_create_token",
      { name, permissions, expiresInDays: expiresInDays ?? null }
    );
    set((state) => ({
      tokens: [...state.tokens, result.token],
      lastCreatedPlaintext: result.plaintext,
    }));
    return result.plaintext;
  },

  revokeToken: async (tokenId) => {
    await invoke("auth_revoke_token", { tokenId });
    set((state) => ({
      tokens: state.tokens.map((t) =>
        t.id === tokenId ? { ...t, isActive: false } : t
      ),
    }));
  },

  deleteToken: async (tokenId) => {
    await invoke("auth_delete_token", { tokenId });
    set((state) => ({
      tokens: state.tokens.filter((t) => t.id !== tokenId),
    }));
  },

  setConfig: async (config) => {
    await invoke("auth_set_config", { config });
    set({ config });
  },

  clearPlaintext: () => set({ lastCreatedPlaintext: null }),
}));
