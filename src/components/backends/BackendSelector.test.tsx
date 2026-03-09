import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackendSelector } from "./BackendSelector";
import type { ComputeBackend } from "../../stores/backends";

function makeBe(overrides: Partial<ComputeBackend> = {}): ComputeBackend {
  return {
    id: "be-1",
    name: "Local Sidecar",
    backend_type: "local_sidecar",
    url: null,
    status: "online",
    latency_ms: null,
    model_name: null,
    cost_per_token: null,
    is_active: true,
    ...overrides,
  };
}

const mockSetActiveBackend = vi.fn().mockResolvedValue(undefined);

let mockBackends: ComputeBackend[] = [];
let mockActiveBackend: ComputeBackend | null = null;

vi.mock("../../stores/backends", () => ({
  useBackends: () => ({
    backends: mockBackends,
    activeBackend: mockActiveBackend,
    setActiveBackend: mockSetActiveBackend,
  }),
}));

describe("BackendSelector", () => {
  it("renders current active backend name", () => {
    mockActiveBackend = makeBe({ name: "My GPU Server" });
    mockBackends = [mockActiveBackend];
    render(<BackendSelector />);
    expect(screen.getByText("My GPU Server")).toBeInTheDocument();
  });

  it('shows "No Backend" when none active', () => {
    mockActiveBackend = null;
    mockBackends = [];
    render(<BackendSelector />);
    expect(screen.getByText("No Backend")).toBeInTheDocument();
  });

  it("opens dropdown on click", () => {
    mockActiveBackend = makeBe();
    mockBackends = [
      mockActiveBackend,
      makeBe({ id: "be-2", name: "Remote API", backend_type: "custom_url" }),
    ];
    render(<BackendSelector />);

    // Dropdown not visible initially
    expect(screen.queryByText("Manage Backends")).not.toBeInTheDocument();

    // Click trigger button
    fireEvent.click(screen.getByText("Local Sidecar"));

    // Dropdown should now be visible
    expect(screen.getByText("Manage Backends")).toBeInTheDocument();
    expect(screen.getByText("Remote API")).toBeInTheDocument();
  });

  it("shows available backends in dropdown", () => {
    mockActiveBackend = makeBe();
    mockBackends = [
      mockActiveBackend,
      makeBe({
        id: "be-2",
        name: "HF Endpoint",
        backend_type: "hf_endpoint",
        status: "deploying",
      }),
    ];
    render(<BackendSelector />);
    fireEvent.click(screen.getByText("Local Sidecar"));
    expect(screen.getByText("HF Endpoint")).toBeInTheDocument();
    expect(screen.getByText("HF")).toBeInTheDocument();
  });

  it('shows "No backends configured" when list is empty and dropdown open', () => {
    mockActiveBackend = null;
    mockBackends = [];
    render(<BackendSelector />);
    fireEvent.click(screen.getByText("No Backend"));
    expect(screen.getByText("No backends configured")).toBeInTheDocument();
  });
});
