import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getDraft, saveDraft, deleteDraft, getDraftsWithFailedSubmission, type Draft } from '../../src/lib/draft.js';

// Replace with a fresh in-memory store before each test for isolation
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeDraft(routineId = 1, overrides: Partial<Draft> = {}): Draft {
  return {
    routineId,
    items: [
      { itemId: 10, checked: true },
      { itemId: 11, checked: false },
    ],
    startedAt: '2026-01-01T08:00:00.000Z',
    idempotencyKey: 'test-key-' + routineId,
    ...overrides,
  };
}

describe('draft', () => {
  describe('saveDraft + getDraft', () => {
    it('round-trips a draft correctly', async () => {
      const draft = makeDraft(1);

      await saveDraft(draft);
      const retrieved = await getDraft(1);

      expect(retrieved).toEqual(draft);
    });

    it('preserves checked items and their state', async () => {
      const draft = makeDraft(2, {
        items: [
          { itemId: 20, checked: true },
          { itemId: 21, checked: false },
          { itemId: 22, checked: true },
        ],
      });

      await saveDraft(draft);
      const retrieved = await getDraft(2);

      expect(retrieved?.items).toEqual(draft.items);
    });

    it('preserves randomized order of items', async () => {
      const draft = makeDraft(3, {
        items: [
          { itemId: 30, checked: false },
          { itemId: 29, checked: true },
          { itemId: 31, checked: false },
        ],
      });

      await saveDraft(draft);
      const retrieved = await getDraft(3);

      expect(retrieved?.items.map((i) => i.itemId)).toEqual([30, 29, 31]);
    });

    it('overwrites an existing draft on save', async () => {
      await saveDraft(makeDraft(4, { idempotencyKey: 'original-key' }));
      await saveDraft(makeDraft(4, { idempotencyKey: 'updated-key' }));

      const retrieved = await getDraft(4);
      expect(retrieved?.idempotencyKey).toBe('updated-key');
    });
  });

  describe('getDraft', () => {
    it('returns undefined for a non-existent routineId', async () => {
      const result = await getDraft(999);
      expect(result).toBeUndefined();
    });
  });

  describe('deleteDraft', () => {
    it('removes the draft from the store', async () => {
      await saveDraft(makeDraft(5));
      await deleteDraft(5);

      const result = await getDraft(5);
      expect(result).toBeUndefined();
    });

    it('does not throw when deleting a non-existent draft', async () => {
      await expect(deleteDraft(999)).resolves.not.toThrow();
    });
  });

  describe('getDraftsWithFailedSubmission', () => {
    it('returns only drafts where submissionFailed is true', async () => {
      await saveDraft(makeDraft(6, { submissionFailed: true }));
      await saveDraft(makeDraft(7, { submissionFailed: false }));
      await saveDraft(makeDraft(8));

      const failed = await getDraftsWithFailedSubmission();
      expect(failed).toHaveLength(1);
      expect(failed[0].routineId).toBe(6);
    });

    it('returns empty array when no failed drafts exist', async () => {
      await saveDraft(makeDraft(9));

      const failed = await getDraftsWithFailedSubmission();
      expect(failed).toHaveLength(0);
    });
  });
});
