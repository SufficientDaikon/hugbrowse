import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatStore } from "./chat";

// Mock rag store
vi.mock("./rag", () => ({
  useRag: {
    getState: () => ({
      getSessionDocs: () => [],
    }),
  },
}));

// Mock rag-engine
vi.mock("../lib/rag-engine", () => ({
  retrieveChunks: vi.fn().mockReturnValue([]),
  buildRagContext: vi.fn().mockReturnValue(""),
}));

// Mock mcp-client
vi.mock("../lib/mcp-client", () => ({
  mcpClient: {
    getStatus: () => "disconnected",
    callTool: vi.fn(),
  },
}));

// Mock backends store
vi.mock("./backends", () => ({
  useBackends: {
    getState: () => ({
      activeBackend: null,
      fetchBackends: vi.fn(),
    }),
  },
}));

describe("chat store", () => {
  beforeEach(() => {
    useChatStore.setState({
      sessions: [],
      currentSessionId: null,
      isStreaming: false,
    });
  });

  it("has empty initial state", () => {
    const state = useChatStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.currentSessionId).toBeNull();
    expect(state.isStreaming).toBe(false);
  });

  it("createSession adds a new session", () => {
    const id = useChatStore.getState().createSession("Test Chat");
    const state = useChatStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].title).toBe("Test Chat");
    expect(state.currentSessionId).toBe(id);
  });

  it("createSession uses default title when none provided", () => {
    useChatStore.getState().createSession();
    const state = useChatStore.getState();
    expect(state.sessions[0].title).toBe("New Chat");
  });

  it("deleteSession removes a session", () => {
    const id1 = useChatStore.getState().createSession("Chat 1");
    useChatStore.getState().createSession("Chat 2");
    useChatStore.getState().deleteSession(id1);
    const state = useChatStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].title).toBe("Chat 2");
  });

  it("deleteSession switches active session if deleted was active", () => {
    useChatStore.getState().createSession("Chat 1");
    const id2 = useChatStore.getState().createSession("Chat 2");
    // id2 is now current
    expect(useChatStore.getState().currentSessionId).toBe(id2);
    useChatStore.getState().deleteSession(id2);
    // Should fall back to first remaining session
    const state = useChatStore.getState();
    expect(state.currentSessionId).toBe(state.sessions[0].id);
  });

  it("setCurrentSession changes the active session", () => {
    const id1 = useChatStore.getState().createSession("Chat 1");
    useChatStore.getState().createSession("Chat 2");
    // id2 is currently active since it was created last
    useChatStore.getState().setCurrentSession(id1);
    expect(useChatStore.getState().currentSessionId).toBe(id1);
  });

  it("renameSession updates session title", () => {
    const id = useChatStore.getState().createSession("Old Title");
    useChatStore.getState().renameSession(id, "New Title");
    const session = useChatStore.getState().sessions.find((s) => s.id === id);
    expect(session?.title).toBe("New Title");
  });

  it("setSystemPrompt updates session system prompt", () => {
    const id = useChatStore.getState().createSession("Chat");
    useChatStore.getState().setSystemPrompt(id, "You are helpful");
    const session = useChatStore.getState().sessions.find((s) => s.id === id);
    expect(session?.systemPrompt).toBe("You are helpful");
  });

  it("clearHistory empties messages for a session", () => {
    const id = useChatStore.getState().createSession("Chat");
    // Manually add a message
    useChatStore.setState((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === id
          ? {
              ...s,
              messages: [
                {
                  id: "m1",
                  role: "user" as const,
                  content: "Hi",
                  timestamp: Date.now(),
                },
              ],
            }
          : s,
      ),
    }));
    expect(
      useChatStore.getState().sessions.find((s) => s.id === id)?.messages,
    ).toHaveLength(1);

    useChatStore.getState().clearHistory(id);
    expect(
      useChatStore.getState().sessions.find((s) => s.id === id)?.messages,
    ).toHaveLength(0);
  });
});
