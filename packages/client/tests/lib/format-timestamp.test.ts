import { describe, it, expect } from "vitest";
import { formatTimestamp, formatCalendarDate } from "../../src/lib/format-timestamp.js";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

describe("formatTimestamp", () => {
  it("normalizes space-separated SQLite timestamps to ISO-8601 T separator", () => {
    const spaceResult = formatTimestamp("2026-03-20 10:00:00", DATE_OPTIONS, "UTC");
    const tResult = formatTimestamp("2026-03-20T10:00:00", DATE_OPTIONS, "UTC");
    expect(spaceResult).toBe(tResult);
  });

  it("appends Z when no timezone indicator is present", () => {
    const withZ = formatTimestamp("2026-03-20T10:00:00", DATE_OPTIONS, "UTC");
    const alreadyZ = formatTimestamp("2026-03-20T10:00:00Z", DATE_OPTIONS, "UTC");
    expect(withZ).toBe(alreadyZ);
  });

  it("does not append Z when offset is already present", () => {
    const withOffset = formatTimestamp("2026-03-20T10:00:00+05:30", DATE_OPTIONS, "UTC");
    // +05:30 offset means 04:30 UTC
    const utcEquivalent = formatTimestamp("2026-03-20T04:30:00Z", DATE_OPTIONS, "UTC");
    expect(withOffset).toBe(utcEquivalent);
  });

  it("formats in the specified IANA timezone", () => {
    const utcResult = formatTimestamp("2026-03-20T10:00:00", DATE_OPTIONS, "UTC");
    const nyResult = formatTimestamp("2026-03-20T10:00:00", DATE_OPTIONS, "America/New_York");
    // Same UTC moment, different local time — they should not be equal
    expect(utcResult).not.toBe(nyResult);
  });

  it("falls back to options without timeZone when an invalid timezone is provided", () => {
    const invalidTzResult = formatTimestamp("2026-03-20T10:00:00", DATE_OPTIONS, "Not/AReal_Zone");
    const noTzResult = formatTimestamp("2026-03-20T10:00:00", DATE_OPTIONS);
    expect(invalidTzResult).toBe(noTzResult);
  });

  it("formats without a timezone using the browser default when timezone is omitted", () => {
    // Should not throw and should return a non-empty string
    const result = formatTimestamp("2026-03-20T10:00:00", DATE_OPTIONS);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

describe("formatCalendarDate", () => {
  it("formats a YYYY-MM-DD date string without UTC normalization", () => {
    const result = formatCalendarDate("2026-03-15", { month: "short", day: "numeric" });
    expect(result).toContain("Mar");
    expect(result).toContain("15");
  });

  it("does not shift the day across timezone boundaries", () => {
    // A late-night UTC timestamp would shift to the previous day if treated
    // as UTC, but formatCalendarDate should always show the literal date.
    const result = formatCalendarDate("2026-01-01", { month: "short", day: "numeric" });
    expect(result).toContain("Jan");
    expect(result).toContain("1");
  });

  it("accepts full DateTimeFormatOptions", () => {
    const result = formatCalendarDate("2026-12-25", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    expect(result).toContain("Dec");
    expect(result).toContain("25");
    expect(result).toContain("Fri");
  });

  it("returns a non-empty string for valid input", () => {
    const result = formatCalendarDate("2026-06-15", { month: "long", day: "numeric" });
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});
