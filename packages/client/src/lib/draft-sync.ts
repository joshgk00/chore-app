import { useEffect, useRef } from "react";
import { getDraftsWithFailedSubmission, deleteDraft } from "./draft.js";
import { api } from "../api/client.js";
import { useOnline } from "../contexts/OnlineContext.js";

export async function syncFailedDrafts(): Promise<void> {
  const drafts = await getDraftsWithFailedSubmission();
  if (drafts.length === 0) return;

  window.dispatchEvent(
    new CustomEvent("chore:sync-start", { detail: { count: drafts.length } }),
  );

  for (const draft of drafts) {
    try {
      const result = await api.post("/api/routine-completions", {
        routineId: draft.routineId,
        items: draft.items,
        startedAt: draft.startedAt,
        idempotencyKey: draft.idempotencyKey,
      });

      if (result.ok || (!result.ok && result.error.code === "CONFLICT")) {
        await deleteDraft(draft.routineId);
      }
    } catch (error) {
      console.warn(`Failed to sync draft for routine ${draft.routineId}`, error);
    }
  }
}

export function useSyncOnReconnect(): void {
  const isOnline = useOnline();
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOffline = !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (wasOffline && isOnline) {
      syncFailedDrafts().catch((error) => {
        console.warn("Draft sync on reconnect failed", error);
      });
    }
  }, [isOnline]);
}
