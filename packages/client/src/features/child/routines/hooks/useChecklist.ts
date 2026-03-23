import { useState, useEffect, useCallback, useRef } from "react";
import { getDraft, saveDraft, deleteDraft } from "../../../../lib/draft.js";
import { generateIdempotencyKey } from "../../../../lib/idempotency.js";
import type { DraftItem } from "../../../../lib/draft.js";
import type { Routine } from "@chore-app/shared";

const TOAST_DURATION_MS = 3000;

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function useChecklist(routine: Routine | undefined) {
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [isDraftInitialized, setIsDraftInitialized] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const routineId = routine?.id;

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  }, []);

  const persistDraft = useCallback(
    (nextItems: DraftItem[]) => {
      if (routineId === undefined) return;
      saveDraft({
        routineId,
        items: nextItems,
        startedAt: new Date().toISOString(),
        idempotencyKey,
      }).catch(() => {});
    },
    [routineId, idempotencyKey],
  );

  useEffect(() => {
    if (isDraftInitialized) return;
    if (!routine) {
      setIsLoadingDraft(false);
      return;
    }

    async function initializeDraft() {
      try {
        const draft = await getDraft(routine!.id);
        const routineItemIds = new Set(routine!.items.map((item) => item.id));

        if (draft) {
          const draftItemIds = new Set(draft.items.map((item) => item.itemId));
          const idsMatch =
            draftItemIds.size === routineItemIds.size &&
            [...draftItemIds].every((id) => routineItemIds.has(id));

          if (idsMatch) {
            setDraftItems(draft.items);
            setIdempotencyKey(draft.idempotencyKey);
            setIsLoadingDraft(false);
            setIsDraftInitialized(true);
            return;
          }

          await deleteDraft(routine!.id);
          showToast("Routine items changed -- starting fresh.");
        }

        const newKey = generateIdempotencyKey();
        let newItems = routine!.items.map((item) => ({
          itemId: item.id,
          isChecked: false,
        }));

        if (routine!.randomizeItems) {
          newItems = shuffleArray(newItems);
        }

        await saveDraft({
          routineId: routine!.id,
          items: newItems,
          startedAt: new Date().toISOString(),
          idempotencyKey: newKey,
        });

        setDraftItems(newItems);
        setIdempotencyKey(newKey);
      } catch {
        const newItems = routine!.items.map((item) => ({
          itemId: item.id,
          isChecked: false,
        }));
        setDraftItems(routine!.randomizeItems ? shuffleArray(newItems) : newItems);
        setIdempotencyKey(generateIdempotencyKey());
      }

      setIsLoadingDraft(false);
      setIsDraftInitialized(true);
    }

    initializeDraft();
  }, [routine, isDraftInitialized, showToast]);

  const handleToggle = useCallback(
    (itemId: number) => {
      setDraftItems((prev) => {
        const next = prev.map((item) =>
          item.itemId === itemId ? { ...item, isChecked: !item.isChecked } : item,
        );
        persistDraft(next);
        return next;
      });
    },
    [persistDraft],
  );

  const handleShuffle = useCallback(() => {
    setDraftItems((prev) => {
      const unchecked = prev.filter((item) => !item.isChecked);
      const checked = prev.filter((item) => item.isChecked);
      const shuffled = [...checked, ...shuffleArray(unchecked)];
      persistDraft(shuffled);
      return shuffled;
    });
  }, [persistDraft]);

  const checkedCount = draftItems.filter((item) => item.isChecked).length;
  const isAllChecked = draftItems.length > 0 && checkedCount === draftItems.length;
  const hasAnyChecked = checkedCount > 0;

  return {
    draftItems,
    isLoadingDraft,
    idempotencyKey,
    toastMessage,
    showToast,
    handleToggle,
    handleShuffle,
    checkedCount,
    isAllChecked,
    hasAnyChecked,
  };
}
