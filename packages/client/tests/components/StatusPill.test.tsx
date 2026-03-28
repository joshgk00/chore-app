import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusPill from "../../src/components/StatusPill.js";

describe("StatusPill", () => {
  it("renders children text", () => {
    render(<StatusPill>3 pending</StatusPill>);

    expect(screen.getByText("3 pending")).toBeInTheDocument();
  });

  it("renders as a span element", () => {
    render(<StatusPill>badge</StatusPill>);

    const el = screen.getByText("badge");
    expect(el.tagName).toBe("SPAN");
  });

  it("applies medium size classes by default", () => {
    render(<StatusPill>5 pts</StatusPill>);

    const el = screen.getByText("5 pts");
    expect(el.className).toContain("px-3");
    expect(el.className).toContain("py-1");
    expect(el.className).toContain("text-sm");
    expect(el.className).toContain("font-display");
  });

  it("applies small size classes when size is sm", () => {
    render(<StatusPill size="sm">2 pending</StatusPill>);

    const el = screen.getByText("2 pending");
    expect(el.className).toContain("px-2.5");
    expect(el.className).toContain("py-0.5");
    expect(el.className).toContain("text-[11px]");
  });

  it("does not apply border by default", () => {
    render(<StatusPill>no border</StatusPill>);

    const el = screen.getByText("no border");
    expect(el.className).toContain("bg-[var(--color-amber-100)]");
    expect(el.className).not.toContain("border");
  });

  it("applies border classes when hasBorder is true", () => {
    render(<StatusPill hasBorder>bordered</StatusPill>);

    const el = screen.getByText("bordered");
    expect(el.className).toContain("border");
    expect(el.className).toContain("border-[var(--color-amber-100)]");
    expect(el.className).toContain("bg-[var(--color-amber-50)]");
  });

  it("always applies rounded-full and amber text color", () => {
    render(<StatusPill>styled</StatusPill>);

    const el = screen.getByText("styled");
    expect(el.className).toContain("rounded-full");
    expect(el.className).toContain("text-[var(--color-amber-700)]");
  });

  it("appends custom className", () => {
    render(<StatusPill className="shrink-0">custom</StatusPill>);

    const el = screen.getByText("custom");
    expect(el.className).toContain("shrink-0");
  });

  it("renders number children", () => {
    render(<StatusPill>{42}</StatusPill>);

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders JSX children", () => {
    render(
      <StatusPill>
        <span data-testid="inner">nested</span>
      </StatusPill>,
    );

    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });
});
