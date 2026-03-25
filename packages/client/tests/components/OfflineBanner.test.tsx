import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OnlineProvider } from "../../src/contexts/OnlineContext.js";
import OfflineBanner from "../../src/components/OfflineBanner.js";

function renderBanner() {
  return render(
    <OnlineProvider>
      <OfflineBanner />
    </OnlineProvider>,
  );
}

function goOffline() {
  act(() => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    window.dispatchEvent(new Event("offline"));
  });
}

function goOnline() {
  act(() => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    window.dispatchEvent(new Event("online"));
  });
}

describe("OfflineBanner", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  it("is not visible when online", () => {
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows banner when offline", () => {
    renderBanner();
    goOffline();

    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("You're offline");
  });

  it("hides banner when coming back online", () => {
    renderBanner();
    goOffline();
    expect(screen.getByRole("status")).toBeInTheDocument();

    goOnline();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("has aria-live polite for screen reader announcement", () => {
    renderBanner();
    goOffline();

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
