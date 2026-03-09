import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children correctly", () => {
    render(<Badge>Hello</Badge>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders with default variant", () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText("Default");
    expect(el.className).toContain("bg-[var(--surface-hover)]");
  });

  it("renders with outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    const el = screen.getByText("Outline");
    expect(el.className).toContain("border");
    expect(el.className).toContain("text-[var(--muted)]");
  });

  it("renders with green variant", () => {
    render(<Badge variant="green">Green</Badge>);
    const el = screen.getByText("Green");
    expect(el.className).toContain("bg-can-run/10");
  });

  it("renders with yellow variant", () => {
    render(<Badge variant="yellow">Yellow</Badge>);
    const el = screen.getByText("Yellow");
    expect(el.className).toContain("bg-maybe-run/10");
  });

  it("renders with red variant", () => {
    render(<Badge variant="red">Red</Badge>);
    const el = screen.getByText("Red");
    expect(el.className).toContain("bg-cant-run/10");
  });

  it("renders with orange variant", () => {
    render(<Badge variant="orange">Orange</Badge>);
    const el = screen.getByText("Orange");
    expect(el.className).toContain("bg-hf-orange/10");
  });

  it("applies custom className", () => {
    render(<Badge className="my-custom-class">Custom</Badge>);
    const el = screen.getByText("Custom");
    expect(el.className).toContain("my-custom-class");
  });
});
