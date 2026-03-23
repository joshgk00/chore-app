import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import { syncFailedDrafts } from "../../src/lib/draft-sync.js";
import {
  saveDraft,
  getDraft,
  resetDbCache,
  type Draft,
} from "../../src/lib/draft.js";

function makeDraft(routineId: number, overrides: Partial<Draft> = {}): Draft {
  return {
    routineId,
    items: [{ itemId: 1, isChecked: true }],
    startedAt: "2026-01-01T08:00:00.000Z",
    idempotencyKey: `key-${routineId}`,
    hasSubmissionFailed: true,
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbCache();
});

describe("syncFailedDrafts", () => {
  it("deletes the draft after a successful sync", async () => {
    const routineId = 1;
    await saveDraft(makeDraft(routineId));

    server.use(
      http.post("/api/routine-completions", () =>
        HttpResponse.json({ data: { id: 1 } }, { status: 200 }),
      ),
    );

    await syncFailedDrafts();

    const draft = await getDraft(routineId);
    expect(draft).toBeUndefined();
  });

  it("deletes the draft on 409 CONFLICT", async () => {
    const routineId = 2;
    await saveDraft(makeDraft(routineId));

    server.use(
      http.post("/api/routine-completions", () =>
        HttpResponse.json(
          { error: { code: "CONFLICT", message: "Already exists" } },
          { status: 409 },
        ),
      ),
    );

    await syncFailedDrafts();

    const draft = await getDraft(routineId);
    expect(draft).toBeUndefined();
  });

  it("leaves the draft intact on network error", async () => {
    const routineId = 3;
    await saveDraft(makeDraft(routineId));

    server.use(
      http.post("/api/routine-completions", () => HttpResponse.error()),
    );

    await syncFailedDrafts();

    const draft = await getDraft(routineId);
    expect(draft).toBeDefined();
    expect(draft?.routineId).toBe(routineId);
  });

  it("completes without error when no failed drafts exist", async () => {
    await expect(syncFailedDrafts()).resolves.not.toThrow();
  });

  it("dispatches chore:sync-start event with the correct count", async () => {
    await saveDraft(makeDraft(10));
    await saveDraft(makeDraft(11));

    server.use(
      http.post("/api/routine-completions", () =>
        HttpResponse.json({ data: { id: 1 } }, { status: 200 }),
      ),
    );

    const listener = vi.fn();
    window.addEventListener("chore:sync-start", listener);

    try {
      await syncFailedDrafts();

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ count: 2 });
    } finally {
      window.removeEventListener("chore:sync-start", listener);
    }
  });

  it("syncs multiple failed drafts and deletes all of them", async () => {
    const routineIds = [20, 21, 22];
    for (const id of routineIds) {
      await saveDraft(makeDraft(id));
    }

    server.use(
      http.post("/api/routine-completions", () =>
        HttpResponse.json({ data: { id: 1 } }, { status: 200 }),
      ),
    );

    await syncFailedDrafts();

    for (const id of routineIds) {
      const draft = await getDraft(id);
      expect(draft).toBeUndefined();
    }
  });

  it("does not dispatch sync-start event when no failed drafts exist", async () => {
    const listener = vi.fn();
    window.addEventListener("chore:sync-start", listener);

    try {
      await syncFailedDrafts();
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("chore:sync-start", listener);
    }
  });
});

// useSyncOnReconnect hook test
// Skipped: Testing this hook requires coordinating OnlineProvider context
// state changes with async IndexedDB operations and MSW responses across
// React render cycles. The timing between the online event, effect execution,
// and the async syncFailedDrafts call creates fragile test conditions.
// The syncFailedDrafts unit tests above cover all the core sync logic that
// the hook delegates to.
