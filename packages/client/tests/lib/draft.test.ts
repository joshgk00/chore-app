import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  getDraft,
  saveDraft,
  deleteDraft,
  getDraftsWithFailedSubmission,
  hasAnyActiveDraft,
  resetDbCache,
  type Draft,
} from "../../src/lib/draft.js";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbCache();
});

function makeDraft(routineId = 1, overrides: Partial<Draft> = {}): Draft {
  return {
    routineId,
    items: [
      { itemId: 10, isChecked: true },
      { itemId: 11, isChecked: false },
    ],
    startedAt: "2026-01-01T08:00:00.000Z",
    idempotencyKey: "test-key-" + routineId,
    ...overrides,
  };
}

describe("draft", () => {
  describe("saveDraft + getDraft", () => {
    it("round-trips a draft correctly", async () => {
      const draft = makeDraft(1);

      await saveDraft(draft);
      const retrieved = await getDraft(1);

      expect(retrieved).toEqual(draft);
    });

    it("preserves isChecked items and their state", async () => {
      const draft = makeDraft(2, {
        items: [
          { itemId: 20, isChecked: true },
          { itemId: 21, isChecked: false },
          { itemId: 22, isChecked: true },
        ],
      });

      await saveDraft(draft);
      const retrieved = await getDraft(2);

      expect(retrieved?.items).toEqual(draft.items);
    });

    it("preserves randomized order of items", async () => {
      const draft = makeDraft(3, {
        items: [
          { itemId: 30, isChecked: false },
          { itemId: 29, isChecked: true },
          { itemId: 31, isChecked: false },
        ],
      });

      await saveDraft(draft);
      const retrieved = await getDraft(3);

      expect(retrieved?.items.map((i) => i.itemId)).toEqual([30, 29, 31]);
    });

    it("overwrites an existing draft on save", async () => {
      await saveDraft(makeDraft(4, { idempotencyKey: "original-key" }));
      await saveDraft(makeDraft(4, { idempotencyKey: "updated-key" }));

      const retrieved = await getDraft(4);
      expect(retrieved?.idempotencyKey).toBe("updated-key");
    });
  });

  describe("getDraft", () => {
    it("returns undefined for a non-existent routineId", async () => {
      const result = await getDraft(999);
      expect(result).toBeUndefined();
    });
  });

  describe("deleteDraft", () => {
    it("removes the draft from the store", async () => {
      await saveDraft(makeDraft(5));
      await deleteDraft(5);

      const result = await getDraft(5);
      expect(result).toBeUndefined();
    });

    it("does not throw when deleting a non-existent draft", async () => {
      await expect(deleteDraft(999)).resolves.not.toThrow();
    });
  });

  describe("getDraftsWithFailedSubmission", () => {
    it("returns only drafts where hasSubmissionFailed is true", async () => {
      await saveDraft(makeDraft(6, { hasSubmissionFailed: true }));
      await saveDraft(makeDraft(7, { hasSubmissionFailed: false }));
      await saveDraft(makeDraft(8));

      const failed = await getDraftsWithFailedSubmission();
      expect(failed).toHaveLength(1);
      expect(failed[0].routineId).toBe(6);
    });

    it("returns empty array when no failed drafts exist", async () => {
      await saveDraft(makeDraft(9));

      const failed = await getDraftsWithFailedSubmission();
      expect(failed).toHaveLength(0);
    });

    it("returns all drafts where hasSubmissionFailed is true", async () => {
      await saveDraft(makeDraft(10, { hasSubmissionFailed: true }));
      await saveDraft(makeDraft(11, { hasSubmissionFailed: true }));
      await saveDraft(makeDraft(12, { hasSubmissionFailed: true }));
      await saveDraft(makeDraft(13, { hasSubmissionFailed: false }));
      await saveDraft(makeDraft(14));

      const failed = await getDraftsWithFailedSubmission();
      expect(failed).toHaveLength(3);
      const ids = failed.map((draft) => draft.routineId).sort();
      expect(ids).toEqual([10, 11, 12]);
    });
  });

  describe("hasAnyActiveDraft", () => {
    it("returns false when no drafts exist", async () => {
      const result = await hasAnyActiveDraft();
      expect(result).toBe(false);
    });

    it("returns false when all draft items are unchecked", async () => {
      await saveDraft(
        makeDraft(20, {
          items: [
            { itemId: 100, isChecked: false },
            { itemId: 101, isChecked: false },
          ],
        }),
      );
      await saveDraft(
        makeDraft(21, {
          items: [{ itemId: 102, isChecked: false }],
        }),
      );

      const result = await hasAnyActiveDraft();
      expect(result).toBe(false);
    });

    it("returns true when at least one draft has a checked item", async () => {
      await saveDraft(
        makeDraft(22, {
          items: [{ itemId: 103, isChecked: false }],
        }),
      );
      await saveDraft(
        makeDraft(23, {
          items: [
            { itemId: 104, isChecked: false },
            { itemId: 105, isChecked: true },
          ],
        }),
      );

      const result = await hasAnyActiveDraft();
      expect(result).toBe(true);
    });

    it("returns false on IndexedDB failure", async () => {
      resetDbCache();
      globalThis.indexedDB = {
        open: () => {
          throw new Error("IndexedDB is not available");
        },
      } as unknown as IDBFactory;

      const result = await hasAnyActiveDraft();
      expect(result).toBe(false);
    });
  });
});
