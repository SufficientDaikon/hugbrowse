import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TierBadge } from "./TierBadge";
import type { HardwareTier } from "../../lib/hf-types";

describe("TierBadge", () => {
  const tiers: { tier: HardwareTier; name: string; icon: string }[] = [
    { tier: "potato", name: "Budget PC", icon: "🥔" },
    { tier: "laptop", name: "Laptop", icon: "💻" },
    { tier: "gaming", name: "Gaming PC", icon: "🎮" },
    { tier: "workstation", name: "Workstation", icon: "🏢" },
    { tier: "server", name: "Server", icon: "🖥️" },
  ];

  it.each(tiers)(
    "renders $tier tier with name $name",
    ({ tier, name, icon }) => {
      render(<TierBadge tier={tier} />);
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.getByText(icon)).toBeInTheDocument();
    },
  );

  it("hides name when showName is false", () => {
    render(<TierBadge tier="gaming" showName={false} />);
    expect(screen.queryByText("Gaming PC")).not.toBeInTheDocument();
    expect(screen.getByText("🎮")).toBeInTheDocument();
  });

  it("applies sm size classes by default", () => {
    const { container } = render(<TierBadge tier="laptop" />);
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-xs");
  });

  it("applies md size classes", () => {
    const { container } = render(<TierBadge tier="laptop" size="md" />);
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-sm");
  });

  it("applies lg size classes", () => {
    const { container } = render(<TierBadge tier="laptop" size="lg" />);
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-base");
  });

  it("passes through custom className", () => {
    const { container } = render(
      <TierBadge tier="server" className="my-custom-class" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("my-custom-class");
  });
});
