import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ModelGrid } from "./ModelGrid";
import type { HFModel } from "../../lib/hf-types";

// Mock useSystemInfo used by ModelCard
vi.mock("../../hooks/useSystemInfo", () => ({
  useSystemInfo: () => ({ data: null }),
}));

function makeModel(id: string): HFModel {
  return {
    _id: id,
    id: `author/${id}`,
    modelId: `author/${id}`,
    private: false,
    disabled: false,
    gated: false,
    pipeline_tag: "text-generation",
    tags: [],
    downloads: 1000,
    likes: 50,
  };
}

describe("ModelGrid", () => {
  it("renders a grid of model cards", () => {
    const models = [makeModel("model-a"), makeModel("model-b")];
    render(
      <MemoryRouter>
        <ModelGrid models={models} />
      </MemoryRouter>,
    );
    expect(screen.getByText("model-a")).toBeInTheDocument();
    expect(screen.getByText("model-b")).toBeInTheDocument();
  });

  it("shows loading skeletons when isLoading is true", () => {
    const { container } = render(
      <MemoryRouter>
        <ModelGrid models={[]} isLoading={true} />
      </MemoryRouter>,
    );
    // ModelCardSkeleton renders Skeleton elements with animate-pulse
    const skeletons = container.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no models and not loading", () => {
    render(
      <MemoryRouter>
        <ModelGrid models={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("No models found")).toBeInTheDocument();
  });

  it("shows suggestion text in empty state", () => {
    render(
      <MemoryRouter>
        <ModelGrid models={[]} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/Try adjusting your search query/),
    ).toBeInTheDocument();
  });
});
