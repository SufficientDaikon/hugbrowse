import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

// Mock the constants to have predictable values
vi.mock("../../lib/constants", () => ({
  TASK_CATEGORIES: [
    { id: "text-generation", label: "Text Generation", icon: "💬" },
    { id: "text-to-image", label: "Text to Image", icon: "🎨" },
  ],
  LIBRARY_FILTERS: ["transformers", "diffusers"],
}));

describe("Sidebar", () => {
  it("renders Filters heading", () => {
    render(<Sidebar />);
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("renders Tasks section", () => {
    render(<Sidebar />);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("renders Libraries section", () => {
    render(<Sidebar />);
    expect(screen.getByText("Libraries")).toBeInTheDocument();
  });

  it("renders task filter items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Text Generation")).toBeInTheDocument();
    expect(screen.getByText("Text to Image")).toBeInTheDocument();
  });

  it("renders library filter items", () => {
    render(<Sidebar />);
    expect(screen.getByText("transformers")).toBeInTheDocument();
    expect(screen.getByText("diffusers")).toBeInTheDocument();
  });
});
