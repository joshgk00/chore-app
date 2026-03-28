import { describe, it, expect } from "vitest";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL } from "../src/constants.js";
import type { ImageModelId } from "../src/constants.js";

describe("IMAGE_MODELS", () => {
  it("contains at least one model", () => {
    expect(IMAGE_MODELS.length).toBeGreaterThan(0);
  });

  it("has unique IDs", () => {
    const ids = IMAGE_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has non-empty labels for every model", () => {
    for (const model of IMAGE_MODELS) {
      expect(model.label.length).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_IMAGE_MODEL", () => {
  it("references an ID that exists in IMAGE_MODELS", () => {
    const ids = IMAGE_MODELS.map((m) => m.id);
    expect(ids).toContain(DEFAULT_IMAGE_MODEL);
  });

  it("is assignable to ImageModelId", () => {
    const id: ImageModelId = DEFAULT_IMAGE_MODEL;
    expect(id).toBe("nano-banana-pro");
  });
});
