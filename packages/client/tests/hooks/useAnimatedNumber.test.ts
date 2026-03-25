import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimatedNumber } from "../../src/hooks/useAnimatedNumber.js";

let matchMediaResult = false;
const rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let nextRafId = 1;

beforeEach(() => {
  matchMediaResult = false;
  rafCallbacks.clear();
  nextRafId = 1;

  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: matchMediaResult,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });

  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAnimatedNumber", () => {
  it("returns target immediately on first render", () => {
    const { result } = renderHook(() => useAnimatedNumber(42));

    expect(result.current).toBe(42);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("skips to target immediately when prefers-reduced-motion is enabled", () => {
    matchMediaResult = true;

    const { result, rerender } = renderHook(
      ({ target }) => useAnimatedNumber(target),
      { initialProps: { target: 0 } },
    );

    rerender({ target: 100 });

    expect(result.current).toBe(100);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("does not call requestAnimationFrame when target has not changed", () => {
    const { rerender } = renderHook(
      ({ target }) => useAnimatedNumber(target),
      { initialProps: { target: 50 } },
    );

    rerender({ target: 50 });

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("cancels animation frame on unmount", () => {
    const { rerender, unmount } = renderHook(
      ({ target }) => useAnimatedNumber(target),
      { initialProps: { target: 0 } },
    );

    act(() => {
      rerender({ target: 100 });
    });

    expect(window.requestAnimationFrame).toHaveBeenCalled();

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });
});
