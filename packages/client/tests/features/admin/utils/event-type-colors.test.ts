import { describe, it, expect } from "vitest";
import { eventTypeDotColor, eventTypeBadgeColor } from "../../../../src/features/admin/utils/event-type-colors.js";

describe("eventTypeDotColor", () => {
  it("returns sky color for routine events", () => {
    expect(eventTypeDotColor("routine_completed")).toBe("bg-[var(--color-sky-500)]");
    expect(eventTypeDotColor("routine_approved")).toBe("bg-[var(--color-sky-500)]");
  });

  it("returns amber-500 for chore events", () => {
    expect(eventTypeDotColor("chore_logged")).toBe("bg-[var(--color-amber-500)]");
  });

  it("returns amber-700 for reward events", () => {
    expect(eventTypeDotColor("reward_requested")).toBe("bg-[var(--color-amber-700)]");
  });

  it("returns muted fallback for unknown event types", () => {
    expect(eventTypeDotColor("badge_earned")).toBe("bg-[var(--color-text-muted)]");
    expect(eventTypeDotColor("unknown")).toBe("bg-[var(--color-text-muted)]");
  });
});

describe("eventTypeBadgeColor", () => {
  it("returns sky badge for routine events", () => {
    const result = eventTypeBadgeColor("routine_completed");
    expect(result).toContain("bg-[var(--color-sky-50)]");
    expect(result).toContain("text-[var(--color-sky-700)]");
  });

  it("returns amber badge for chore events", () => {
    const result = eventTypeBadgeColor("chore_logged");
    expect(result).toContain("bg-[var(--color-amber-50)]");
    expect(result).toContain("text-[var(--color-amber-700)]");
  });

  it("returns amber badge for reward events", () => {
    const result = eventTypeBadgeColor("reward_requested");
    expect(result).toContain("bg-[var(--color-amber-50)]");
    expect(result).toContain("text-[var(--color-amber-700)]");
  });

  it("returns muted fallback for unknown event types", () => {
    const result = eventTypeBadgeColor("unknown");
    expect(result).toContain("bg-[var(--color-surface-muted)]");
    expect(result).toContain("text-[var(--color-text-muted)]");
  });
});
