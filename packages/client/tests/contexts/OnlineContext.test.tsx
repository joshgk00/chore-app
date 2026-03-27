import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OnlineProvider, useOnline } from "../../src/contexts/OnlineContext.js";

function OnlineStatus() {
  const isOnline = useOnline();
  return <span data-testid="status">{isOnline ? "online" : "offline"}</span>;
}

function renderWithOnlineProvider() {
  return render(
    <OnlineProvider>
      <OnlineStatus />
    </OnlineProvider>,
  );
}

describe("OnlineContext", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });
  });

  it("returns true when navigator.onLine is true", () => {
    renderWithOnlineProvider();
    expect(screen.getByTestId("status")).toHaveTextContent("online");
  });

  it("returns false after an offline event", () => {
    renderWithOnlineProvider();

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, writable: true });
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByTestId("status")).toHaveTextContent("offline");
  });

  it("returns true after an online event", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    renderWithOnlineProvider();
    expect(screen.getByTestId("status")).toHaveTextContent("offline");

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: true, writable: true });
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByTestId("status")).toHaveTextContent("online");
  });
});
