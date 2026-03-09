import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";

// Mock hooks and libs used by SettingsPage
vi.mock("../stores/settings", () => ({
  useSettings: () => ({
    theme: "system",
    setTheme: vi.fn(),
    hfToken: null,
    hfUsername: null,
    setHfToken: vi.fn(),
    searchHistory: [],
    clearSearchHistory: vi.fn(),
    tierOverride: null,
    setTierOverride: vi.fn(),
    alertThresholds: { ram: 85, vram: 90, cpu: 95 },
    setAlertThresholds: vi.fn(),
    autoLoadLastModel: false,
    setAutoLoadLastModel: vi.fn(),
    lastModelPath: null,
    mcpServers: ["https://huggingface.co/mcp"],
    setMcpServers: vi.fn(),
    proxyUrl: null,
    setProxyUrl: vi.fn(),
  }),
}));

vi.mock("../lib/hf-api", () => ({
  hfApi: { setToken: vi.fn(), validateToken: vi.fn() },
}));

vi.mock("../hooks/useMCP", () => ({
  useMCP: () => ({
    status: "disconnected",
    tools: [],
    isConnected: false,
    callTool: vi.fn(),
    reconnect: vi.fn(),
  }),
}));

vi.mock("../hooks/useTier", () => ({
  useTier: () => ({ data: { icon: "🎮", name: "Gaming PC" } }),
}));

vi.mock("../components/backends/BackendSettings", () => ({
  BackendSettings: () => (
    <div data-testid="backend-settings">BackendSettings</div>
  ),
}));

describe("SettingsPage", () => {
  it("renders Settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows HuggingFace API Token section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("HuggingFace API Token")).toBeInTheDocument();
  });

  it("has token input with placeholder", () => {
    render(<SettingsPage />);
    expect(
      screen.getByPlaceholderText("hf_xxxxxxxxxxxxxxxxxxxxx"),
    ).toBeInTheDocument();
  });

  it("shows Theme section with toggle buttons", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("shows Compute Backends section", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/Compute Backends/)).toBeInTheDocument();
  });

  it("shows About section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
  });

  it("shows Hardware Tier section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Hardware Tier")).toBeInTheDocument();
  });

  it("shows Resource Alerts section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Resource Alerts")).toBeInTheDocument();
  });
});
