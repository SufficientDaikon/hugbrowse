import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChatPage } from "./ChatPage";

// scrollIntoView is not implemented in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock all stores and child components
vi.mock("../stores/chat", () => ({
  useChatStore: () => ({
    sessions: [
      {
        id: "s1",
        title: "Test Session",
        systemPrompt: "",
        messages: [
          { id: "m1", role: "user", content: "Hello", timestamp: Date.now() },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    currentSessionId: "s1",
    isStreaming: false,
    createSession: vi.fn(),
    sendMessage: vi.fn(),
    stopStreaming: vi.fn(),
    setSystemPrompt: vi.fn(),
  }),
}));

vi.mock("../stores/inference", () => ({
  useInference: () => ({
    info: { status: "running", model_name: "llama-7b", port: 11434 },
  }),
}));

vi.mock("../stores/backends", () => ({
  useBackends: () => ({
    activeBackend: {
      id: "be-1",
      name: "Local Sidecar",
      backend_type: "local_sidecar",
      url: null,
      status: "online",
      latency_ms: null,
      model_name: null,
      cost_per_token: null,
      is_active: true,
    },
    backends: [],
    setActiveBackend: vi.fn(),
  }),
}));

vi.mock("../stores/imports", () => ({
  useImports: () => ({
    importedModels: [],
    detectedServers: [],
    isScanning: false,
    importFile: vi.fn(),
    autoDetectAll: vi.fn().mockResolvedValue([]),
    fetchImportedModels: vi.fn(),
  }),
}));

vi.mock("../components/chat/SessionSidebar", () => ({
  SessionSidebar: () => <aside data-testid="session-sidebar">Sidebar</aside>,
}));

vi.mock("../components/chat/ChatMessage", () => ({
  ChatMessage: ({ message }: { message: { content: string } }) => (
    <div data-testid="chat-message">{message.content}</div>
  ),
}));

vi.mock("../components/chat/ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input">ChatInput</div>,
}));

vi.mock("../components/models/ModelRunPanel", () => ({
  ModelRunPanel: () => <div data-testid="model-run-panel">ModelRunPanel</div>,
}));

vi.mock("../components/models/LoadedModelsPanel", () => ({
  LoadedModelsPanel: () => <div data-testid="loaded-models-panel">LoadedModelsPanel</div>,
}));

vi.mock("../components/backends/BackendSelector", () => ({
  BackendSelector: () => (
    <div data-testid="backend-selector">BackendSelector</div>
  ),
}));

describe("ChatPage", () => {
  it("renders the session sidebar", () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>);
    expect(screen.getByTestId("session-sidebar")).toBeInTheDocument();
  });

  it("renders chat input area", () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>);
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });

  it("renders backend selector", () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>);
    expect(screen.getByTestId("backend-selector")).toBeInTheDocument();
  });

  it("shows session title in header", () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>);
    expect(screen.getByText("Test Session")).toBeInTheDocument();
  });

  it("renders chat messages", () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
