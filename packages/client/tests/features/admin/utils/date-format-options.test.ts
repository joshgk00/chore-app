import { describe, it, expect } from "vitest";
import { DATE_OPTIONS, DATETIME_OPTIONS } from "../../../../src/features/admin/utils/date-format-options.js";

describe("DATE_OPTIONS", () => {
  it("includes month and day only", () => {
    expect(DATE_OPTIONS).toEqual({
      month: "short",
      day: "numeric",
    });
  });

  it("formats a date as expected", () => {
    const formatted = new Date(2026, 2, 15).toLocaleDateString("en-US", DATE_OPTIONS);
    expect(formatted).toBe("Mar 15");
  });
});

describe("DATETIME_OPTIONS", () => {
  it("includes month, day, hour, and minute", () => {
    expect(DATETIME_OPTIONS).toEqual({
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  });

  it("formats a date with time", () => {
    const dt = new Date(2026, 2, 15, 14, 30);
    const formatted = dt.toLocaleDateString("en-US", DATETIME_OPTIONS);
    expect(formatted).toContain("Mar");
    expect(formatted).toContain("15");
  });
});
