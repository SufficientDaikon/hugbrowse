import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useBackends } from "./backends";
import type { ComputeBackend } from "./backends";

const mockedInvoke = vi.mocked(invoke);

function makeFakeBackend(
  overrides: Partial<ComputeBackend> = {},
): ComputeBackend {
  return {
    id: "be-1",
    name: "Test Backend",
    backend_type: "custom_url",
    url: "http://localhost:8080",
    status: "online",
    latency_ms: 50,
    model_name: "llama-7b",
    cost_per_token: null,
    is_active: false,
    ...overrides,
  };
}

describe("backends store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useBackends.setState({
      backends: [],
      activeBackend: null,
      isLoading: false,
    });
  });

  it("has correct initial state", () => {
    const state = useBackends.getState();
    expect(state.backends).toEqual([]);
    expect(state.activeBackend).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("fetchBackends calls invoke and updates state", async () => {
    const fakeBackends = [makeFakeBackend()];
    const fakeActive = makeFakeBackend({ id: "be-1", is_active: true });

    mockedInvoke
      .mockResolvedValueOnce(fakeBackends) // get_backends
      .mockResolvedValueOnce(fakeActive); // get_active_backend

    await useBackends.getState().fetchBackends();

    expect(mockedInvoke).toHaveBeenCalledWith("get_backends");
    expect(mockedInvoke).toHaveBeenCalledWith("get_active_backend");

    const state = useBackends.getState();
    expect(state.backends).toEqual(fakeBackends);
    expect(state.activeBackend).toEqual(fakeActive);
    expect(state.isLoading).toBe(false);
  });

  it("addBackend calls invoke and adds to state", async () => {
    const newBackend = makeFakeBackend({ id: "be-2", name: "New Backend" });
    mockedInvoke.mockResolvedValueOnce(newBackend); // add_backend

    const result = await useBackends
      .getState()
      .addBackend(
        "New Backend",
        "http://localhost:9090",
        "my-key",
        "custom_url",
      );

    expect(mockedInvoke).toHaveBeenCalledWith("add_backend", {
      name: "New Backend",
      url: "http://localhost:9090",
      apiKey: "my-key",
      backendType: "custom_url",
    });
    expect(result).toEqual(newBackend);
    expect(useBackends.getState().backends).toContainEqual(newBackend);
  });

  it("removeBackend calls invoke and removes from state", async () => {
    const be1 = makeFakeBackend({ id: "be-1" });
    const be2 = makeFakeBackend({ id: "be-2", name: "Second" });
    useBackends.setState({ backends: [be1, be2], activeBackend: be1 });

    mockedInvoke.mockResolvedValueOnce(undefined); // remove_backend

    await useBackends.getState().removeBackend("be-1");

    expect(mockedInvoke).toHaveBeenCalledWith("remove_backend", { id: "be-1" });
    const state = useBackends.getState();
    expect(state.backends).toHaveLength(1);
    expect(state.backends[0].id).toBe("be-2");
    expect(state.activeBackend).toBeNull(); // was the active one
  });

  it("setActiveBackend calls invoke and updates activeBackend", async () => {
    const be1 = makeFakeBackend({ id: "be-1" });
    const be2 = makeFakeBackend({ id: "be-2", name: "Second" });
    useBackends.setState({ backends: [be1, be2], activeBackend: null });

    mockedInvoke.mockResolvedValueOnce(undefined); // set_active_backend

    await useBackends.getState().setActiveBackend("be-2");

    expect(mockedInvoke).toHaveBeenCalledWith("set_active_backend", {
      id: "be-2",
    });
    expect(useBackends.getState().activeBackend).toEqual(be2);
  });

  it("testConnection returns result from invoke", async () => {
    const result = {
      online: true,
      latency_ms: 42,
      model_name: "llama",
      error: null,
    };
    mockedInvoke.mockResolvedValueOnce(result);

    const res = await useBackends
      .getState()
      .testConnection("http://localhost:8080", "key");

    expect(mockedInvoke).toHaveBeenCalledWith("test_backend_connection", {
      url: "http://localhost:8080",
      apiKey: "key",
    });
    expect(res).toEqual(result);
  });

  it("testConnection returns error result on failure", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("Connection refused"));

    const res = await useBackends.getState().testConnection("http://bad-url");

    expect(res.online).toBe(false);
    expect(res.error).toContain("Connection refused");
  });
});
