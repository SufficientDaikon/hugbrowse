import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResourceGauge } from "./ResourceGauge";

describe("ResourceGauge", () => {
  it("renders gauge with label", () => {
    render(<ResourceGauge label="CPU" icon="⚡" value={45} />);
    expect(screen.getByText(/CPU/)).toBeInTheDocument();
  });

  it("shows percentage value", () => {
    render(<ResourceGauge label="RAM" icon="🧠" value={65} />);
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("renders icon", () => {
    render(<ResourceGauge label="CPU" icon="⚡" value={50} />);
    expect(screen.getByText(/⚡/)).toBeInTheDocument();
  });

  it("shows used/total when provided", () => {
    render(
      <ResourceGauge
        label="RAM"
        icon="🧠"
        value={50}
        used="8 GB"
        total="16 GB"
      />,
    );
    expect(screen.getByText("8 GB / 16 GB")).toBeInTheDocument();
  });

  it("shows N/A when unavailable", () => {
    render(
      <ResourceGauge label="GPU" icon="💾" value={0} unavailable={true} />,
    );
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("shows unavailable text when provided", () => {
    render(
      <ResourceGauge
        label="GPU"
        icon="💾"
        value={0}
        unavailable={true}
        unavailableText="No GPU found"
      />,
    );
    expect(screen.getByText("No GPU found")).toBeInTheDocument();
  });

  it("applies red text class for values >= 90", () => {
    const { container } = render(
      <ResourceGauge label="CPU" icon="⚡" value={95} />,
    );
    const percentEl = screen.getByText("95%");
    expect(percentEl.className).toContain("text-red-500");
    // Also check the SVG uses cant-run color for high values
    const circles = container.querySelectorAll("circle");
    const activeCircle = circles[1];
    expect(activeCircle?.getAttribute("stroke")).toBe("var(--cant-run)");
  });

  it("uses maybe-run color for values 70-89", () => {
    const { container } = render(
      <ResourceGauge label="CPU" icon="⚡" value={75} />,
    );
    const circles = container.querySelectorAll("circle");
    const activeCircle = circles[1];
    expect(activeCircle?.getAttribute("stroke")).toBe("var(--maybe-run)");
  });

  it("uses default accent color for low values", () => {
    const { container } = render(
      <ResourceGauge label="CPU" icon="⚡" value={30} />,
    );
    const circles = container.querySelectorAll("circle");
    const activeCircle = circles[1];
    expect(activeCircle?.getAttribute("stroke")).toBe("var(--accent)");
  });
});
