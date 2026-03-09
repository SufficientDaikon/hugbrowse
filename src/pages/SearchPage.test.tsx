import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SearchPage } from "./SearchPage";

// Mock useModels to control loading state and data
vi.mock("../hooks/useModels", () => ({
  useModels: vi.fn(() => ({
    data: { pages: [] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  })),
}));

// Mock useSystemInfo
vi.mock("../hooks/useSystemInfo", () => ({
  useSystemInfo: () => ({ data: null }),
}));

function renderSearchPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SearchPage", () => {
  it("renders the page title", () => {
    renderSearchPage();
    expect(screen.getByText("Trending Models")).toBeInTheDocument();
  });

  it("shows models loaded count when not loading", () => {
    renderSearchPage();
    expect(screen.getByText("0 models loaded")).toBeInTheDocument();
  });

  it("shows sort dropdown", () => {
    renderSearchPage();
    // SortDropdown renders a <select> with options
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it("shows loading skeletons when loading", async () => {
    const { useModels } = await import("../hooks/useModels");
    vi.mocked(useModels).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useModels>);

    const { container } = renderSearchPage();
    // ModelGrid shows skeletons (divs with animate-pulse)
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders 'No models found' when empty and not loading", async () => {
    const { useModels } = await import("../hooks/useModels");
    vi.mocked(useModels).mockReturnValue({
      data: { pages: [] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useModels>);

    renderSearchPage();
    expect(screen.getByText("No models found")).toBeInTheDocument();
  });
});
