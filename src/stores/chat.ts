import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
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
    port: number,
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

      sendMessage: async (sessionId, content, port) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;

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

        const history = [
          ...(session.systemPrompt
            ? [{ role: "system", content: session.systemPrompt }]
            : []),
          ...session.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content },
        ];

        try {
          const res = await fetch(
            `http://127.0.0.1:${port}/v1/chat/completions`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "local",
                messages: history,
                stream: true,
                temperature: 0.7,
              }),
              signal: _abortController.signal,
            },
          );

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          }

          const reader = res.body!.getReader();
          const dec = new TextDecoder();
          let buf = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") break;
              try {
                const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
                if (delta) {
                  patchSession((s) => ({
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === asstId
                        ? { ...m, content: m.content + delta }
                        : m,
                    ),
                  }));
                }
              } catch {
                /* non-JSON SSE line */
              }
            }
          }
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
