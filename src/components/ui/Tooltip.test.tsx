import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("renders trigger content", () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("does not show tooltip content initially", () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    expect(screen.queryByText("Tip text")).not.toBeInTheDocument();
  });

  it("shows tooltip on hover", async () => {
    const user = userEvent.setup();
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    await user.hover(screen.getByText("Hover me"));
    expect(screen.getByText("Tip text")).toBeInTheDocument();
  });

  it("hides tooltip when not hovered", async () => {
    const user = userEvent.setup();
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    await user.hover(screen.getByText("Hover me"));
    expect(screen.getByText("Tip text")).toBeInTheDocument();
    await user.unhover(screen.getByText("Hover me"));
    expect(screen.queryByText("Tip text")).not.toBeInTheDocument();
  });
});
