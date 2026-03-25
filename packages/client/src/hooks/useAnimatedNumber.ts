import { useState, useEffect, useRef } from "react";

const ANIMATION_DURATION_MS = 300;

/**
 * Animates a number from its previous value to the current target.
 * Respects prefers-reduced-motion by skipping to the target immediately.
 */
export function useAnimatedNumber(target: number): number {
  const [displayed, setDisplayed] = useState(target);
  const previousRef = useRef(target);
  const frameRef = useRef<number>();

  useEffect(() => {
    const from = previousRef.current;
    previousRef.current = target;

    if (from === target) return;

    // Skip animation when user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplayed(target);
      return;
    }

    const startTime = performance.now();
    const delta = target - from;

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
      // Ease-out curve
      const eased = 1 - (1 - progress) ** 3;
      setDisplayed(Math.round(from + delta * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target]);

  return displayed;
}
