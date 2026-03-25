import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "../../test-utils.js";
import Mascot from "../../../src/components/mascot/Mascot.js";

describe("Mascot", () => {
  it("renders an SVG element with img role", () => {
    renderWithProviders(<Mascot state="greeting" />);

    const svg = screen.getByRole("img", { name: /mascot/i });
    expect(svg).toBeInTheDocument();
    expect(svg.tagName.toLowerCase()).toBe("svg");
  });

  it("sets data-state attribute matching the state prop", () => {
    renderWithProviders(<Mascot state="happy" />);

    const svg = screen.getByRole("img", { name: /mascot/i });
    expect(svg).toHaveAttribute("data-state", "happy");
  });

  it("produces different aria-labels for different states", () => {
    const { unmount } = renderWithProviders(<Mascot state="greeting" />);
    const greetingSvg = screen.getByRole("img");
    const greetingLabel = greetingSvg.getAttribute("aria-label");
    unmount();

    renderWithProviders(<Mascot state="celebrating" />);
    const celebratingSvg = screen.getByRole("img");
    const celebratingLabel = celebratingSvg.getAttribute("aria-label");

    expect(greetingLabel).not.toBe(celebratingLabel);
  });

  it("produces different SVG content for different states", () => {
    const { unmount } = renderWithProviders(<Mascot state="greeting" />);
    const greetingSvg = screen.getByRole("img");
    const greetingMarkup = greetingSvg.innerHTML;
    unmount();

    renderWithProviders(<Mascot state="sleeping" />);
    const sleepingSvg = screen.getByRole("img");
    const sleepingMarkup = sleepingSvg.innerHTML;

    expect(greetingMarkup).not.toBe(sleepingMarkup);
  });

  it("applies custom className when provided", () => {
    renderWithProviders(<Mascot state="greeting" className="my-custom-class" />);

    const svg = screen.getByRole("img", { name: /mascot/i });
    expect(svg.className.baseVal).toContain("my-custom-class");
  });

  it("applies state-specific CSS class", () => {
    renderWithProviders(<Mascot state="celebrating" />);

    const svg = screen.getByRole("img", { name: /mascot/i });
    expect(svg.className.baseVal).toContain("mascot-celebrating");
  });
});
