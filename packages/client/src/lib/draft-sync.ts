import { useEffect, useRef } from "react";
import { getDraftsWithFailedSubmission, deleteDraft } from "./draft.js";
import { api } from "../api/client.js";
import { useOnline } from "../contexts/OnlineContext.js";

export function formatLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
        checklistSnapshot: JSON.stringify(
          draft.items.map((item) => ({ itemId: item.itemId, isChecked: item.isChecked })),
        ),
        randomizedOrder: null,
        idempotencyKey: draft.idempotencyKey,
        localDate: formatLocalDate(),
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
