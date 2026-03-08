import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useRag } from "./rag";
import { retrieveChunks, buildRagContext } from "../lib/rag-engine";
import { mcpClient } from "../lib/mcp-client";
import { useBackends, type BackendType } from "./backends";

export type Role = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  tokensPerSecond?: number;
  /** NFR-001: First token latency in milliseconds */
  firstTokenMs?: number;
  /** FR-043: Flag for tool-call messages */
  isToolCall?: boolean;
  toolName?: string;
  /** NEW: Track which backend generated this response */
  backendId?: string;
  backendName?: string;
  backendType?: BackendType;
}

export interface ChatSession {
  id: string;
  title: string;
  systemPrompt: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isStreaming: boolean;
  // Actions
  createSession: (title?: string) => string;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  setCurrentSession: (id: string) => void;
  setSystemPrompt: (id: string, prompt: string) => void;
  clearHistory: (id: string) => void;
  sendMessage: (
    sessionId: string,
    content: string,
  ) => Promise<void>;
  stopStreaming: () => void;
}

let _abortController: AbortController | null = null;

function uid() {
  return crypto.randomUUID();
}

function newSession(title = "New Chat"): ChatSession {
  return {
    id: uid(),
    title,
    systemPrompt: "",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      isStreaming: false,

      createSession: (title) => {
        const s = newSession(title);
        set((st) => ({
          sessions: [s, ...st.sessions],
          currentSessionId: s.id,
        }));
        return s.id;
      },

      deleteSession: (id) =>
        set((st) => {
          const sessions = st.sessions.filter((s) => s.id !== id);
          return {
            sessions,
            currentSessionId:
              st.currentSessionId === id
                ? (sessions[0]?.id ?? null)
                : st.currentSessionId,
          };
        }),

      renameSession: (id, title) =>
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === id ? { ...s, title, updatedAt: Date.now() } : s,
          ),
        })),

      setCurrentSession: (id) => set({ currentSessionId: id }),

      setSystemPrompt: (id, systemPrompt) =>
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === id ? { ...s, systemPrompt } : s,
          ),
        })),

      clearHistory: (id) =>
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === id ? { ...s, messages: [] } : s,
          ),
        })),

      sendMessage: async (sessionId, content) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;

        // Get active backend info for tracking
        const activeBackend = useBackends.getState().activeBackend;
        if (!activeBackend) {
          console.error("No active backend selected");
          return;
        }

        const userMsg: ChatMessage = {
          id: uid(),
          role: "user",
          content,
          timestamp: Date.now(),
        };
        const asstId = uid();
        const asstMsg: ChatMessage = {
          id: asstId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
          backendId: activeBackend.id,
          backendName: activeBackend.name,
          backendType: activeBackend.backend_type,
        };

        const patchSession = (patch: (s: ChatSession) => ChatSession) =>
          set((st) => ({
            sessions: st.sessions.map((s) =>
              s.id === sessionId ? patch(s) : s,
            ),
          }));

        patchSession((s) => ({
          ...s,
          messages: [...s.messages, userMsg, asstMsg],
          updatedAt: Date.now(),
        }));
        set({ isStreaming: true });

        _abortController = new AbortController();

        // FR-035: RAG context injection — retrieve relevant chunks from attached docs
        let ragContext = "";
        const ragDocs = useRag.getState().getSessionDocs(sessionId);
        const indexedDocs = ragDocs.filter((d) => d.status === "indexed");
        if (indexedDocs.length > 0) {
          const docNames = new Map(indexedDocs.map((d) => [d.id, d.filename]));
          const chunks = retrieveChunks(
            content,
            indexedDocs.map((d) => d.id),
            5,
          );
          ragContext = buildRagContext(chunks, docNames);
        }

        const history = [
          ...(session.systemPrompt
            ? [{ role: "system", content: session.systemPrompt }]
            : []),
          ...(ragContext
            ? [{ role: "system", content: ragContext }]
            : []),
          ...session.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content },
        ];

        // EC-010: Rough context window overflow guard (~4 chars per token, 4096 default)
        const MAX_CONTEXT_CHARS = 16000;
        let totalChars = history.reduce((n, m) => n + m.content.length, 0);
        while (totalChars > MAX_CONTEXT_CHARS && history.length > 2) {
          const removed = history.splice(1, 1)[0];
          totalChars -= removed.content.length;
        }

        let unlisten: UnlistenFn | null = null;
        let tokenCount = 0;
        const streamStart = performance.now();
        let firstTokenTime: number | null = null;

        try {
          // Set up event listeners for streaming response
          const unlistenDelta = await listen<{ content: string; done: boolean }>(
            "chat-stream-delta",
            (event) => {
              const { content: delta } = event.payload;
              if (delta && !_abortController?.signal.aborted) {
                tokenCount++;
                // NFR-001: Track first token latency
                if (tokenCount === 1) {
                  firstTokenTime = performance.now() - streamStart;
                }
                const elapsed = (performance.now() - streamStart) / 1000;
                const tps = elapsed > 0 ? tokenCount / elapsed : 0;
                patchSession((s) => ({
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === asstId
                      ? {
                          ...m,
                          content: m.content + delta,
                          tokensPerSecond: Math.round(tps * 10) / 10,
                          ...(firstTokenTime !== null ? { firstTokenMs: Math.round(firstTokenTime) } : {}),
                        }
                      : m,
                  ),
                }));
              }
            }
          );

          const unlistenDone = await listen<{ content: string; done: boolean }>(
            "chat-stream-done",
            () => {
              // Stream completed successfully
              if (unlisten) unlisten();
            }
          );

          const unlistenError = await listen<{ error: string }>(
            "chat-stream-error",
            (event) => {
              const { error } = event.payload;
              if (!_abortController?.signal.aborted) {
                patchSession((s) => ({
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === asstId
                      ? { ...m, content: `⚠️ Error: ${error}` }
                      : m,
                  ),
                }));
              }
              if (unlisten) unlisten();
            }
          );

          // Composite unlisten function
          unlisten = () => {
            unlistenDelta();
            unlistenDone();
            unlistenError();
          };

          // Start the proxy chat completion
          await invoke("proxy_chat_completions", {
            messages_json: JSON.stringify(history),
            model: null, // Use backend's default model
            temperature: 0.7,
            stream: true,
          });

        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            patchSession((s) => ({
              ...s,
              messages: s.messages.map((m) =>
                m.id === asstId
                  ? { ...m, content: `⚠️ Error: ${(err as Error).message}` }
                  : m,
              ),
            }));
          }
        } finally {
          // Clean up event listeners
          if (unlisten) unlisten();

          // FR-041: Check if LLM response contains a tool call pattern
          const finalSession = get().sessions.find(
            (s) => s.id === sessionId,
          );
          const asstContent =
            finalSession?.messages.find((m) => m.id === asstId)?.content ?? "";
          const toolCallMatch = asstContent.match(
            /<tool_call>\s*\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*"arguments"\s*:\s*(\{[^}]*\})/,
          );
          if (toolCallMatch && mcpClient.getStatus() === "connected") {
            const toolName = toolCallMatch[1];
            try {
              const toolArgs = JSON.parse(toolCallMatch[2]);
              const result = await mcpClient.callTool(toolName, toolArgs);
              if (result) {
                const toolMsg: ChatMessage = {
                  id: uid(),
                  role: "tool",
                  content:
                    result.content
                      ?.map((c) => c.text ?? "")
                      .join("\n") ?? "",
                  timestamp: Date.now(),
                  isToolCall: true,
                  toolName,
                };
                patchSession((s) => ({
                  ...s,
                  messages: [...s.messages, toolMsg],
                }));
              }
            } catch {
              /* tool call parse/dispatch failed — non-critical */
            }
          }

          patchSession((s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === asstId ? { ...m, isStreaming: false } : m,
            ),
          }));
          set({ isStreaming: false });
          _abortController = null;
        }
      },

      stopStreaming: () => {
        _abortController?.abort();
        _abortController = null;
        set({ isStreaming: false });
      },
    }),
    {
      name: "hugbrowse-chat",
      partialize: (s) => ({
        sessions: s.sessions,
        currentSessionId: s.currentSessionId,
      }),
    },
  ),
);
