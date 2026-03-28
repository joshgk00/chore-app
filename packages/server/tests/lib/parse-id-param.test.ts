import { describe, it, expect } from "vitest";
import { parseIdParam } from "../../src/lib/parse-id-param.js";
import { ValidationError } from "../../src/lib/errors.js";

describe("parseIdParam", () => {
  it("returns a number for a valid positive integer string", () => {
    expect(parseIdParam("1")).toBe(1);
    expect(parseIdParam("42")).toBe(42);
    expect(parseIdParam("999999")).toBe(999999);
  });

  it("throws ValidationError for non-numeric strings", () => {
    expect(() => parseIdParam("abc")).toThrow(ValidationError);
    expect(() => parseIdParam("12abc")).toThrow(ValidationError);
    expect(() => parseIdParam("abc12")).toThrow(ValidationError);
  });

  it("throws ValidationError for negative numbers", () => {
    expect(() => parseIdParam("-1")).toThrow(ValidationError);
  });

  it("throws ValidationError for zero", () => {
    expect(() => parseIdParam("0")).toThrow(ValidationError);
  });

  it("throws ValidationError for decimal strings", () => {
    expect(() => parseIdParam("1.5")).toThrow(ValidationError);
    expect(() => parseIdParam("3.0")).toThrow(ValidationError);
  });

  it("throws ValidationError for empty string", () => {
    expect(() => parseIdParam("")).toThrow(ValidationError);
  });

  it("throws ValidationError for whitespace", () => {
    expect(() => parseIdParam(" 1")).toThrow(ValidationError);
    expect(() => parseIdParam("1 ")).toThrow(ValidationError);
  });

  it("uses default label in error message", () => {
    expect(() => parseIdParam("abc")).toThrow("Invalid ID");
  });

  it("uses custom label in error message", () => {
    expect(() => parseIdParam("abc", "chore log ID")).toThrow("Invalid chore log ID");
  });

  it("throws ValidationError for strings with special characters", () => {
    expect(() => parseIdParam("1;DROP TABLE")).toThrow(ValidationError);
    expect(() => parseIdParam("1e2")).toThrow(ValidationError);
  });
});
