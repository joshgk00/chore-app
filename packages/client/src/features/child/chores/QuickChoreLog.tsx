import { useState } from "react";
import { useChores } from "./hooks/useChores.js";
import { useSubmitChoreLog } from "./hooks/useSubmitChoreLog.js";
import { useCancelChoreLog } from "./hooks/useCancelChoreLog.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { generateIdempotencyKey } from "../../../lib/idempotency.js";
import type { Chore, ChoreTier, ChoreLog } from "@chore-app/shared";

function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function QuickChoreLog() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null);
  const [recentLog, setRecentLog] = useState<ChoreLog | null>(null);
  const isOnline = useOnline();
  const { data: chores, isLoading, error } = useChores();
  const submitMutation = useSubmitChoreLog();
  const cancelMutation = useCancelChoreLog();

  function handleTierSelect(tier: ChoreTier) {
    if (!selectedChore) return;

    submitMutation.mutate(
      {
        choreId: selectedChore.id,
        tierId: tier.id,
        idempotencyKey: generateIdempotencyKey(),
        localDate: getLocalDate(),
      },
      {
        onSuccess: (log) => {
          setRecentLog(log);
          setSelectedChore(null);
        },
        onError: (err) => {
          const apiErr = err as { code?: string };
          if (apiErr.code === "CONFLICT") {
            setSelectedChore(null);
          }
        },
      },
    );
  }

  function handleCancelLog() {
    if (!recentLog) return;
    cancelMutation.mutate(recentLog.id, {
      onSuccess: () => {
        setRecentLog(null);
      },
    });
  }

  function handleClose() {
    setSelectedChore(null);
    setRecentLog(null);
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-4 py-4 font-semibold text-gray-600 transition-all duration-200 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
        aria-label="Log a chore"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Log a Chore
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-200"
      role="dialog"
      aria-label="Log a chore"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">
          {selectedChore ? selectedChore.name : "Pick a Chore"}
        </h3>
        <button
          type="button"
          onClick={handleClose}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close chore log"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!isOnline && (
        <p className="mt-2 text-sm text-amber-600" aria-live="polite">
          You&apos;re offline. Chore logging is unavailable right now.
        </p>
      )}

      {isLoading && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <div className="sr-only">Loading chores...</div>
          {[1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" aria-live="assertive">
          Could not load chores. Please try again.
        </p>
      )}

      {recentLog && (
        <div className="mt-3 rounded-xl bg-green-50 p-3" aria-live="polite">
          <p className="font-medium text-green-800">
            Logged {recentLog.choreNameSnapshot} for +{recentLog.pointsSnapshot} pts
          </p>
          {recentLog.status === "pending" && (
            <button
              type="button"
              onClick={handleCancelLog}
              disabled={cancelMutation.isPending}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {cancelMutation.isPending ? "Canceling..." : "Cancel"}
            </button>
          )}
        </div>
      )}

      {chores && !selectedChore && !recentLog && (
        <div className="mt-3 space-y-2">
          {chores.length === 0 ? (
            <p className="py-4 text-center text-gray-500" aria-live="polite">
              No chores available yet.
            </p>
          ) : (
            chores.map((chore) => (
              <button
                key={chore.id}
                type="button"
                onClick={() => setSelectedChore(chore)}
                disabled={!isOnline}
                className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-left font-medium text-gray-700 transition-all duration-200 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{chore.name}</span>
                <span className="text-sm text-gray-400">
                  {chore.tiers.length} {chore.tiers.length === 1 ? "tier" : "tiers"}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {selectedChore && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => setSelectedChore(null)}
            className="mb-1 text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            &larr; Back to chores
          </button>
          {selectedChore.tiers.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => handleTierSelect(tier)}
              disabled={!isOnline || submitMutation.isPending}
              className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-left transition-all duration-200 hover:bg-green-50 hover:ring-1 hover:ring-green-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium text-gray-700">{tier.name}</span>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-700">
                +{tier.points} pts
              </span>
            </button>
          ))}

          {submitMutation.isPending && (
            <p className="text-center text-sm text-gray-500" aria-live="polite">
              Logging...
            </p>
          )}
          {submitMutation.isError && (
            <p className="text-center text-sm text-red-600" aria-live="assertive">
              This chore may no longer be available. Please close and try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
