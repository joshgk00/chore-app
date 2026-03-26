import { useCallback, useRef, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useRoutine } from "./hooks/useRoutine.js";
import { useSubmitRoutine } from "./hooks/useSubmitRoutine.js";
import { useChecklist } from "./hooks/useChecklist.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { saveDraft, deleteDraft } from "../../../lib/draft.js";
import ChecklistItem from "./ChecklistItem.js";

const NAVIGATION_DELAY_MS = 1500;

export default function RoutineChecklist() {
  const { id } = useParams<{ id: string }>();
  const routineId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const isOnline = useOnline();
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: routine, isLoading: isRoutineLoading, error: routineError } = useRoutine(routineId);
  const submitRoutine = useSubmitRoutine();
  const [isShowingCelebration, setIsShowingCelebration] = useState(false);

  const {
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
    localDate,
    randomizedOrder,
  } = useChecklist(routine);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!routine || !isAllChecked || !isOnline || submitRoutine.isPending) return;

    const checklistSnapshot = JSON.stringify(
      draftItems.map((item) => ({
        itemId: item.itemId,
        isChecked: item.isChecked,
      })),
    );

    const randomizedOrderPayload = randomizedOrder
      ? JSON.stringify(randomizedOrder)
      : null;

    submitRoutine.mutate(
      {
        routineId: routine.id,
        checklistSnapshot,
        randomizedOrder: randomizedOrderPayload,
        idempotencyKey,
        localDate,
      },
      {
        onSuccess: async () => {
          try { await deleteDraft(routine.id); } catch { /* IndexedDB unavailable */ }
          setIsShowingCelebration(true);
          navigationTimeoutRef.current = setTimeout(() => navigate("/routines"), 800);
        },
        onError: async (error: unknown) => {
          const apiError = error && typeof error === "object" && "code" in error
            ? (error as { code?: string; message?: string })
            : null;

          if (apiError?.code === "CONFLICT") {
            if (apiError.message?.includes("archived")) {
              try { await deleteDraft(routine.id); } catch { /* IndexedDB unavailable */ }
              showToast("This routine has been archived.");
              navigationTimeoutRef.current = setTimeout(() => navigate("/routines"), NAVIGATION_DELAY_MS);
              return;
            }
            if (apiError.message?.includes("already_completed")) {
              try { await deleteDraft(routine.id); } catch { /* IndexedDB unavailable */ }
              showToast("You already completed this routine!");
              navigationTimeoutRef.current = setTimeout(() => navigate("/routines"), NAVIGATION_DELAY_MS);
              return;
            }
          }

          try {
            await saveDraft({
              routineId: routine.id,
              items: draftItems,
              startedAt: new Date().toISOString(),
              idempotencyKey,
              hasSubmissionFailed: true,
            });
          } catch {
            // IndexedDB unavailable
          }
          showToast("Something went wrong. We'll retry when you're back online.");
        },
      },
    );
  }, [routine, draftItems, isAllChecked, isOnline, idempotencyKey, localDate, randomizedOrder, submitRoutine, navigate, showToast]);

  if (routineError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] p-4">
        <div aria-live="assertive" className="text-center">
          <p className="font-display text-xl font-bold text-[var(--color-text-secondary)]">Oops! Could not load this routine.</p>
          <p className="mt-2 text-[var(--color-text-muted)]">Please try again in a moment.</p>
          <Link
            to="/routines"
            className="mt-6 inline-block rounded-full bg-[var(--color-amber-400)] px-6 py-3 font-display font-bold text-white shadow-card transition-all duration-200 hover:bg-[var(--color-amber-500)]"
          >
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  if (isRoutineLoading || isLoadingDraft || !routine) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] p-4">
        <div aria-live="polite" className="sr-only">Loading routine...</div>
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--color-surface-muted)]" />
            <div className="h-8 w-48 rounded-lg bg-[var(--color-surface-muted)]" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-3xl bg-[var(--color-surface-muted)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const routineItemsById = new Map(routine.items.map((item) => [item.id, item]));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <div aria-live="assertive" role="status" className="fixed left-4 right-4 top-4 z-50 pointer-events-none">
        {toastMessage && (
          <div className="rounded-2xl bg-[var(--color-text)] px-4 py-3 text-center font-medium text-white shadow-toast pointer-events-auto">
            {toastMessage}
          </div>
        )}
      </div>

      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_95%,transparent)] px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/routines"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] transition-all duration-200 hover:bg-[var(--color-border)]"
              aria-label="Back to routines"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-display text-xl font-bold text-[var(--color-text)]">{routine.name}</h1>
          </div>

          <span className="rounded-full bg-[var(--color-amber-100)] px-3 py-1 text-sm font-bold text-[var(--color-amber-700)]">
            {routine.points} {routine.points === 1 ? "pt" : "pts"}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-muted)]">
            {checkedCount} of {draftItems.length} completed
          </p>

          {routine.randomizeItems && (
            <button
              type="button"
              onClick={handleShuffle}
              disabled={hasAnyChecked}
              className="rounded-full bg-[var(--color-sky-100)] px-3 py-1 text-sm font-medium text-[var(--color-sky-700)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Shuffle checklist order"
            >
              Shuffle
            </button>
          )}
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-emerald-400)] transition-all duration-300"
            style={{ width: draftItems.length > 0 ? `${(checkedCount / draftItems.length) * 100}%` : "0%" }}
            role="progressbar"
            aria-valuenow={checkedCount}
            aria-valuemin={0}
            aria-valuemax={draftItems.length}
            aria-label="Checklist progress"
          />
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {draftItems.map((draftItem) => {
          const routineItem = routineItemsById.get(draftItem.itemId);
          if (!routineItem) return null;

          return (
            <ChecklistItem
              key={draftItem.itemId}
              item={routineItem}
              isChecked={draftItem.isChecked}
              onToggle={() => handleToggle(draftItem.itemId)}
            />
          );
        })}
      </div>

      <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_95%,transparent)] p-4 backdrop-blur">
        {!isOnline && (
          <p className="mb-2 text-center text-sm font-medium text-[var(--color-amber-700)]">
            You're offline -- connect to submit.
          </p>
        )}
        <div className="celebration-container">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isAllChecked || !isOnline || submitRoutine.isPending}
            title={!isOnline ? "You're offline" : undefined}
            className="w-full rounded-full bg-[var(--color-emerald-500)] px-6 py-4 font-display text-lg font-bold text-white shadow-card transition-all duration-200 enabled:hover:bg-[var(--color-emerald-600)] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitRoutine.isPending ? "Submitting..." : "Complete Routine!"}
          </button>
          {isShowingCelebration && (
            <>
              <span className="sparkle" aria-hidden="true" />
              <span className="sparkle" aria-hidden="true" />
              <span className="sparkle" aria-hidden="true" />
              <span className="sparkle" aria-hidden="true" />
            </>
          )}
        </div>
      </div>

      {isShowingCelebration && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          aria-live="polite"
        >
          <p className="animate-tab-enter font-display text-4xl font-bold text-[var(--color-emerald-500)]" data-emoji>
            &#127881;
          </p>
        </div>
      )}
    </div>
  );
}
