import { useState, useEffect, useCallback, useRef } from "react";
import { getDraft, saveDraft, deleteDraft } from "../../../../lib/draft.js";
import { generateIdempotencyKey } from "../../../../lib/idempotency.js";
import { formatLocalDate } from "../../../../lib/draft-sync.js";
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
  const startedAtRef = useRef<string>(new Date().toISOString());
  const localDateRef = useRef<string>(formatLocalDate());
  const randomizedOrderRef = useRef<number[] | null>(null);

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
        startedAt: startedAtRef.current,
        idempotencyKey,
        localDate: localDateRef.current,
        randomizedOrder: randomizedOrderRef.current ?? undefined,
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
      const r = routine!;
      try {
        const draft = await getDraft(r.id);
        const routineItemIds = new Set(r.items.map((item) => item.id));

        if (draft) {
          const draftItemIds = new Set(draft.items.map((item) => item.itemId));
          const idsMatch =
            draftItemIds.size === routineItemIds.size &&
            [...draftItemIds].every((id) => routineItemIds.has(id));

          if (idsMatch) {
            startedAtRef.current = draft.startedAt;
            localDateRef.current = draft.localDate ?? formatLocalDate();
            randomizedOrderRef.current = draft.randomizedOrder ?? null;
            setDraftItems(draft.items);
            setIdempotencyKey(draft.idempotencyKey);
            setIsLoadingDraft(false);
            setIsDraftInitialized(true);
            return;
          }

          await deleteDraft(r.id);
          showToast("Routine items changed -- starting fresh.");
        }

        const newKey = generateIdempotencyKey();
        const now = new Date().toISOString();
        const localDate = formatLocalDate();
        let newItems = r.items.map((item) => ({
          itemId: item.id,
          isChecked: false,
        }));

        if (r.randomizeItems) {
          newItems = shuffleArray(newItems);
        }

        const randomizedOrder = r.randomizeItems
          ? newItems.map((item) => item.itemId)
          : null;

        startedAtRef.current = now;
        localDateRef.current = localDate;
        randomizedOrderRef.current = randomizedOrder;

        await saveDraft({
          routineId: r.id,
          items: newItems,
          startedAt: now,
          idempotencyKey: newKey,
          localDate,
          randomizedOrder: randomizedOrder ?? undefined,
        });

        setDraftItems(newItems);
        setIdempotencyKey(newKey);
      } catch {
        const newItems = r.items.map((item) => ({
          itemId: item.id,
          isChecked: false,
        }));
        const shuffled = r.randomizeItems ? shuffleArray(newItems) : newItems;
        randomizedOrderRef.current = r.randomizeItems
          ? shuffled.map((item) => item.itemId)
          : null;
        setDraftItems(shuffled);
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
    localDate: localDateRef.current,
    randomizedOrder: randomizedOrderRef.current,
  };
}
