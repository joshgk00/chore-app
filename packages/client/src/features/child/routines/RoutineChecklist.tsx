import { useCallback, useRef, useEffect } from "react";
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
          navigate("/routines");
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div aria-live="assertive" className="text-center">
          <p className="text-xl font-bold text-gray-700">Oops! Could not load this routine.</p>
          <p className="mt-2 text-gray-500">Please try again in a moment.</p>
          <Link
            to="/routines"
            className="mt-6 inline-block rounded-full bg-amber-400 px-6 py-3 font-bold text-white shadow-md transition-all duration-200 hover:bg-amber-500"
          >
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  if (isRoutineLoading || isLoadingDraft || !routine) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div aria-live="polite" className="sr-only">Loading routine...</div>
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="h-8 w-48 rounded-lg bg-gray-200" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const routineItemsById = new Map(routine.items.map((item) => [item.id, item]));

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div aria-live="assertive" role="status" className="fixed left-4 right-4 top-4 z-50 pointer-events-none">
        {toastMessage && (
          <div className="rounded-2xl bg-gray-800 px-4 py-3 text-center font-medium text-white shadow-lg pointer-events-auto">
            {toastMessage}
          </div>
        )}
      </div>

      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/routines"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all duration-200 hover:bg-gray-200"
              aria-label="Back to routines"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-gray-800">{routine.name}</h1>
          </div>

          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
            {routine.points} {routine.points === 1 ? "pt" : "pts"}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {checkedCount} of {draftItems.length} completed
          </p>

          {routine.randomizeItems && (
            <button
              type="button"
              onClick={handleShuffle}
              disabled={hasAnyChecked}
              className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700 transition-all duration-200 enabled:hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Shuffle checklist order"
            >
              Shuffle
            </button>
          )}
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
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

      <div className="sticky bottom-0 border-t border-gray-100 bg-white/95 p-4 backdrop-blur">
        {!isOnline && (
          <p className="mb-2 text-center text-sm font-medium text-amber-700">
            You're offline -- connect to submit.
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isAllChecked || !isOnline || submitRoutine.isPending}
          className="w-full rounded-full bg-emerald-500 px-6 py-4 text-lg font-bold text-white shadow-md transition-all duration-200 enabled:hover:bg-emerald-600 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitRoutine.isPending ? "Submitting..." : "Complete Routine!"}
        </button>
      </div>
    </div>
  );
}
