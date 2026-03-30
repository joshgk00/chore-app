import { describe, it, expect } from "vitest";
import { dayNumber, subtractDays } from "../../src/lib/date-utils.js";

describe("dayNumber", () => {
  it("returns a consistent day number for a given date", () => {
    const result = dayNumber("2024-01-01");
    expect(typeof result).toBe("number");
    expect(Number.isInteger(result)).toBe(true);
  });

  it("returns consecutive numbers for consecutive dates", () => {
    const day1 = dayNumber("2024-03-14");
    const day2 = dayNumber("2024-03-15");
    expect(day2 - day1).toBe(1);
  });

  it("handles month boundaries", () => {
    const lastDay = dayNumber("2024-01-31");
    const firstDay = dayNumber("2024-02-01");
    expect(firstDay - lastDay).toBe(1);
  });

  it("handles year boundaries", () => {
    const dec31 = dayNumber("2023-12-31");
    const jan1 = dayNumber("2024-01-01");
    expect(jan1 - dec31).toBe(1);
  });

  it("returns the same value for the same date", () => {
    expect(dayNumber("2024-06-15")).toBe(dayNumber("2024-06-15"));
  });

  it("returns correct difference for dates a week apart", () => {
    const start = dayNumber("2024-03-01");
    const end = dayNumber("2024-03-08");
    expect(end - start).toBe(7);
  });
});

describe("subtractDays", () => {
  it("subtracts days from a date string", () => {
    expect(subtractDays("2024-03-15", 1)).toBe("2024-03-14");
  });

  it("handles month boundary subtraction", () => {
    expect(subtractDays("2024-03-01", 1)).toBe("2024-02-29");
  });

  it("handles year boundary subtraction", () => {
    expect(subtractDays("2024-01-01", 1)).toBe("2023-12-31");
  });

  it("returns the same date when subtracting zero days", () => {
    expect(subtractDays("2024-06-15", 0)).toBe("2024-06-15");
  });
});
