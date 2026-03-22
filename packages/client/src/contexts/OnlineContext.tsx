import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { getDraftsWithFailedSubmission, deleteDraft } from "../lib/draft.js";
import { api } from "../api/client.js";

interface OnlineContextValue {
  isOnline: boolean;
}

const OnlineContext = createContext<OnlineContextValue>({ isOnline: true });

export function useOnline(): boolean {
  return useContext(OnlineContext).isOnline;
}

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const retryDelayRef = useRef(1000);

  const syncFailedDrafts = useCallback(async () => {
    const drafts = await getDraftsWithFailedSubmission();
    if (drafts.length === 0) return;

    // Surface toast — consumers can listen for this event
    window.dispatchEvent(new CustomEvent("chore:sync-start", { detail: { count: drafts.length } }));

    for (const draft of drafts) {
      try {
        const result = await api.post(`/api/routine-completions`, {
          routineId: draft.routineId,
          items: draft.items,
          startedAt: draft.startedAt,
          idempotencyKey: draft.idempotencyKey,
        });

        if (result.ok || (!result.ok && result.error.code === "CONFLICT")) {
          await deleteDraft(draft.routineId);
        }
        // On network error: leave in IndexedDB, retry on next online event
      } catch {
        // leave draft intact, retry next time
      }
    }

    retryDelayRef.current = 1000;
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      syncFailedDrafts().catch(() => undefined);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncFailedDrafts]);

  return <OnlineContext.Provider value={{ isOnline }}>{children}</OnlineContext.Provider>;
}
