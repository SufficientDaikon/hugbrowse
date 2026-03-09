import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ModelCard } from "./ModelCard";
import type { HFModel } from "../../lib/hf-types";

// Mock useSystemInfo to return null by default (no sysinfo)
vi.mock("../../hooks/useSystemInfo", () => ({
  useSystemInfo: () => ({ data: null }),
}));

function makeModel(overrides: Partial<HFModel> = {}): HFModel {
  return {
    _id: "abc123",
    id: "test-author/test-model-7b",
    modelId: "test-author/test-model-7b",
    private: false,
    disabled: false,
    gated: false,
    pipeline_tag: "text-generation",
    tags: [],
    downloads: 15000,
    likes: 320,
    library_name: "transformers",
    ...overrides,
  };
}

function renderWithRouter(model: HFModel) {
  return render(
    <MemoryRouter>
      <ModelCard model={model} />
    </MemoryRouter>,
  );
}

describe("ModelCard", () => {
  it("renders model name and author", () => {
    renderWithRouter(makeModel());
    expect(screen.getByText("test-author")).toBeInTheDocument();
    expect(screen.getByText("test-model-7b")).toBeInTheDocument();
  });

  it("shows download count", () => {
    renderWithRouter(makeModel({ downloads: 15000 }));
    expect(screen.getByText("15.0K")).toBeInTheDocument();
  });

  it("shows likes count", () => {
    renderWithRouter(makeModel({ likes: 320 }));
    expect(screen.getByText("320")).toBeInTheDocument();
  });

  it("shows pipeline tag", () => {
    renderWithRouter(makeModel({ pipeline_tag: "text-generation" }));
    expect(screen.getByText("text-generation")).toBeInTheDocument();
  });

  it("shows library name badge", () => {
    renderWithRouter(makeModel({ library_name: "transformers" }));
    expect(screen.getByText("transformers")).toBeInTheDocument();
  });

  it("shows GGUF badge when tagged", () => {
    renderWithRouter(makeModel({ tags: ["gguf"] }));
    expect(screen.getByText("GGUF")).toBeInTheDocument();
  });

  it("renders as a button (navigable)", () => {
    renderWithRouter(makeModel());
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("shows compatibility indicator dot", () => {
    const { container } = renderWithRouter(makeModel());
    // There should be a compat indicator dot with a title
    const dot = container.querySelector("[title]");
    expect(dot).toBeInTheDocument();
  });

  it("shows estimated params when extractable from name", () => {
    renderWithRouter(makeModel({ id: "author/llama-7b" }));
    expect(screen.getByText(/7B params/)).toBeInTheDocument();
  });
});
