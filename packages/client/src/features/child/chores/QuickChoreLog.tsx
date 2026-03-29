import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChores } from "./hooks/useChores.js";
import { useSubmitChoreLog } from "./hooks/useSubmitChoreLog.js";
import { useCancelChoreLog } from "./hooks/useCancelChoreLog.js";
import { useChoreLogStatus } from "./hooks/useChoreLogStatus.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { formatLocalDate } from "../../../lib/draft-sync.js";
import { invalidatePointsRelated } from "../../../lib/query-keys.js";
import type { Chore, ChoreTier, ChoreLog } from "@chore-app/shared";
import StatusPill from "../../../components/StatusPill.js";

const AUTO_DISMISS_DELAY_MS = 5000;

export default function QuickChoreLog() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null);
  const [recentLog, setRecentLog] = useState<ChoreLog | null>(null);
  const isOnline = useOnline();
  const { data: chores, isLoading, error } = useChores();
  const submitMutation = useSubmitChoreLog();
  const cancelMutation = useCancelChoreLog();
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const autoDismissRef = useRef<ReturnType<typeof setTimeout>>();
  const isPausedRef = useRef(false);
  const queryClient = useQueryClient();

  const pendingLogId = recentLog?.status === "pending" ? recentLog.id : null;
  const { data: polledLog } = useChoreLogStatus(pendingLogId);

  useEffect(() => {
    if (polledLog && polledLog.status !== "pending") {
      setRecentLog(polledLog);
      invalidatePointsRelated(queryClient);
    }
  }, [polledLog, queryClient]);

  function scheduleAutoDismiss() {
    clearTimeout(autoDismissRef.current);
    autoDismissRef.current = setTimeout(() => {
      if (!isPausedRef.current) {
        setRecentLog(null);
      }
    }, AUTO_DISMISS_DELAY_MS);
  }

  const recentLogId = recentLog?.id;
  const recentLogStatus = recentLog?.status;
  const isCancelPending = cancelMutation.isPending;
  useEffect(() => {
    clearTimeout(autoDismissRef.current);
    if (!recentLogId) {
      isPausedRef.current = false;
      return;
    }
    if (recentLogStatus === "pending" || isCancelPending) return;

    scheduleAutoDismiss();

    return () => clearTimeout(autoDismissRef.current);
  }, [recentLogId, recentLogStatus, isCancelPending]);

  function handleConfirmationFocus() {
    isPausedRef.current = true;
    clearTimeout(autoDismissRef.current);
  }

  function handleConfirmationBlur() {
    isPausedRef.current = false;
    if (recentLog && recentLog.status !== "pending" && !cancelMutation.isPending) {
      scheduleAutoDismiss();
    }
  }

  function handleChoreSelect(chore: Chore) {
    idempotencyKeyRef.current = crypto.randomUUID();
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
        <div
          className={`mt-3 rounded-xl p-3 ${
            recentLog.status === "rejected"
              ? "bg-[var(--color-surface-muted)]"
              : "bg-[var(--color-emerald-50)]"
          }`}
          aria-live="polite"
          onFocus={handleConfirmationFocus}
          onBlur={handleConfirmationBlur}
        >
          <p
            className={`font-medium ${
              recentLog.status === "rejected"
                ? "text-[var(--color-text-muted)]"
                : "text-[var(--color-emerald-700)]"
            }`}
          >
            {recentLog.status === "approved" &&
              `${recentLog.choreNameSnapshot} approved! +${recentLog.pointsSnapshot} pts earned`}
            {recentLog.status === "pending" &&
              `Logged ${recentLog.choreNameSnapshot} for +${recentLog.pointsSnapshot} pts`}
            {recentLog.status === "rejected" &&
              `${recentLog.choreNameSnapshot} was not approved`}
          </p>
          {recentLog.status === "pending" && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Waiting for approval…
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRecentLog(null)}
              className="min-h-touch rounded-xl bg-[var(--color-amber-50)] px-4 py-2 text-sm font-semibold text-[var(--color-amber-700)] transition-colors hover:bg-[var(--color-amber-100)]"
            >
              Log Another Chore
            </button>
            {recentLog.status === "pending" && (
              <button
                type="button"
                onClick={handleCancelLog}
                disabled={cancelMutation.isPending}
                className="min-h-touch text-sm font-medium text-[var(--color-red-600)] disabled:opacity-50"
              >
                {cancelMutation.isPending ? "Canceling..." : "Cancel"}
              </button>
            )}
          </div>
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
                title={!isOnline ? "You're offline" : undefined}
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
              title={!isOnline ? "You're offline" : undefined}
              className="flex w-full items-center justify-between rounded-xl bg-[var(--color-surface-muted)] px-4 py-3 text-left transition-all duration-200 hover:bg-[var(--color-emerald-50)] hover:ring-1 hover:ring-[var(--color-emerald-400)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium text-[var(--color-text-secondary)]">{tier.name}</span>
              <StatusPill>
                +{tier.points} pts
              </StatusPill>
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
