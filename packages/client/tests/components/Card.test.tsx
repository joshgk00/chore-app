import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Card from "../../src/components/Card.js";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Hello</Card>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders as div by default", () => {
    render(<Card>content</Card>);
    const el = screen.getByText("content");
    expect(el.tagName).toBe("DIV");
  });

  it("renders as section when specified", () => {
    render(
      <Card as="section" aria-label="Test section">
        content
      </Card>,
    );
    expect(screen.getByRole("region", { name: "Test section" })).toBeInTheDocument();
  });

  it("applies default card classes", () => {
    render(<Card>content</Card>);
    const el = screen.getByText("content");
    expect(el.className).toContain("rounded-2xl");
    expect(el.className).toContain("bg-[var(--color-surface)]");
    expect(el.className).toContain("shadow-card");
    expect(el.className).toContain("p-5");
  });

  it("allows custom padding", () => {
    render(<Card padding="p-4">content</Card>);
    const el = screen.getByText("content");
    expect(el.className).toContain("p-4");
    expect(el.className).not.toContain("p-5");
  });

  it("merges additional class names", () => {
    render(<Card className="text-center mt-6">content</Card>);
    const el = screen.getByText("content");
    expect(el.className).toContain("text-center");
    expect(el.className).toContain("mt-6");
    expect(el.className).toContain("rounded-2xl");
  });

  it("passes aria-live through", () => {
    render(<Card aria-live="polite">content</Card>);
    expect(screen.getByText("content")).toHaveAttribute("aria-live", "polite");
  });
});
