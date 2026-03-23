import { useState, useRef } from "react";
import { useChores } from "./hooks/useChores.js";
import { useSubmitChoreLog } from "./hooks/useSubmitChoreLog.js";
import { useCancelChoreLog } from "./hooks/useCancelChoreLog.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { generateIdempotencyKey } from "../../../lib/idempotency.js";
import { formatLocalDate } from "../../../lib/draft-sync.js";
import type { Chore, ChoreTier, ChoreLog } from "@chore-app/shared";

export default function QuickChoreLog() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null);
  const [recentLog, setRecentLog] = useState<ChoreLog | null>(null);
  const isOnline = useOnline();
  const { data: chores, isLoading, error } = useChores();
  const submitMutation = useSubmitChoreLog();
  const cancelMutation = useCancelChoreLog();
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  function handleChoreSelect(chore: Chore) {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setSelectedChore(chore);
  }

  function handleTierSelect(tier: ChoreTier) {
    if (!selectedChore) return;

    submitMutation.mutate(
      {
        choreId: selectedChore.id,
        tierId: tier.id,
        idempotencyKey: idempotencyKeyRef.current,
        localDate: formatLocalDate(),
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
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 font-semibold text-[var(--color-text-muted)] transition-all duration-200 hover:border-[var(--color-amber-400)] hover:bg-[var(--color-amber-50)] hover:text-[var(--color-amber-700)]"
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
      className="rounded-3xl bg-[var(--color-surface)] p-4 shadow-card ring-1 ring-[var(--color-border)]"
      role="region"
      aria-label="Log a chore"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-[var(--color-text)]">
          {selectedChore ? selectedChore.name : "Pick a Chore"}
        </h3>
        <button
          type="button"
          onClick={handleClose}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-muted)]"
          aria-label="Close chore log"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!isOnline && (
        <p className="mt-2 text-sm text-[var(--color-amber-600)]" aria-live="polite">
          You&apos;re offline. Chore logging is unavailable right now.
        </p>
      )}

      {isLoading && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <div className="sr-only">Loading chores...</div>
          {[1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--color-surface-muted)]" />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--color-red-600)]" aria-live="assertive">
          Could not load chores. Please try again.
        </p>
      )}

      {recentLog && (
        <div className="mt-3 rounded-xl bg-[var(--color-emerald-50)] p-3" aria-live="polite">
          <p className="font-medium text-[var(--color-emerald-700)]">
            Logged {recentLog.choreNameSnapshot} for +{recentLog.pointsSnapshot} pts
          </p>
          {recentLog.status === "pending" && (
            <button
              type="button"
              onClick={handleCancelLog}
              disabled={cancelMutation.isPending}
              className="mt-2 min-h-touch text-sm font-medium text-[var(--color-red-600)] hover:text-[var(--color-red-600)] disabled:opacity-50"
            >
              {cancelMutation.isPending ? "Canceling..." : "Cancel"}
            </button>
          )}
        </div>
      )}

      {chores && !selectedChore && !recentLog && (
        <div className="mt-3 space-y-2">
          {chores.length === 0 ? (
            <p className="py-4 text-center text-[var(--color-text-muted)]" aria-live="polite">
              No chores available yet.
            </p>
          ) : (
            chores.map((chore) => (
              <button
                key={chore.id}
                type="button"
                onClick={() => handleChoreSelect(chore)}
                disabled={!isOnline}
                className="flex w-full items-center justify-between rounded-xl bg-[var(--color-surface-muted)] px-4 py-3 text-left font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-amber-50)] hover:text-[var(--color-amber-700)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{chore.name}</span>
                <span className="text-sm text-[var(--color-text-faint)]">
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
            className="mb-1 min-h-touch text-sm font-medium text-[var(--color-amber-600)] hover:text-[var(--color-amber-700)]"
          >
            &larr; Back to chores
          </button>
          {selectedChore.tiers.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => handleTierSelect(tier)}
              disabled={!isOnline || submitMutation.isPending}
              className="flex w-full items-center justify-between rounded-xl bg-[var(--color-surface-muted)] px-4 py-3 text-left transition-all duration-200 hover:bg-[var(--color-emerald-50)] hover:ring-1 hover:ring-[var(--color-emerald-400)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium text-[var(--color-text-secondary)]">{tier.name}</span>
              <span className="rounded-full bg-[var(--color-amber-100)] px-2.5 py-0.5 text-sm font-bold text-[var(--color-amber-700)]">
                +{tier.points} pts
              </span>
            </button>
          ))}

          {submitMutation.isPending && (
            <p className="text-center text-sm text-[var(--color-text-muted)]" aria-live="polite">
              Logging...
            </p>
          )}
          {submitMutation.isError && (
            <p className="text-center text-sm text-[var(--color-red-600)]" aria-live="assertive">
              Something went wrong. Please check your connection and try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
