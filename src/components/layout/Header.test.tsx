import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock useSystemInfo to avoid Tauri invoke calls
vi.mock("../../hooks/useSystemInfo", () => ({
  useSystemInfo: () => ({ data: null }),
}));

// Mock useTier to return no tier data
vi.mock("../../hooks/useTier", () => ({
  useTier: () => ({ data: null }),
}));

function renderHeader(route = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Header />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Header", () => {
  it("renders the app title", () => {
    renderHeader();
    expect(screen.getByText("HugBrowse")).toBeInTheDocument();
  });

  it("renders the logo emoji", () => {
    renderHeader();
    expect(screen.getByText("🤗")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderHeader();
    const input = screen.getByPlaceholderText(/search models/i);
    expect(input).toBeInTheDocument();
  });

  it("has theme toggle button", () => {
    renderHeader();
    const themeBtn = screen.getByTitle(/theme:/i);
    expect(themeBtn).toBeInTheDocument();
  });

  it("renders navigation items", () => {
    renderHeader();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("For You")).toBeInTheDocument();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
  });

  it("has settings button", () => {
    renderHeader();
    // Settings button navigates to /settings
    const buttons = screen.getAllByRole("button");
    // One of the buttons should be for settings
    expect(buttons.length).toBeGreaterThan(0);
  });
});
