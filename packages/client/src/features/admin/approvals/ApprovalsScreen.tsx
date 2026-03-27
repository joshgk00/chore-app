import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { useAdminTimezone } from "../hooks/useAdminTimezone.js";
import { formatTimestamp } from "../../../lib/format-timestamp.js";
import type {
  PendingApprovals,
  RoutineCompletion,
  ChoreLog,
  RewardRequest,
  ApprovalType,
} from "@chore-app/shared";

function usePendingApprovals(isOnline: boolean) {
  return useQuery({
    queryKey: ["admin", "approvals"],
    queryFn: async () => {
      const result = await api.get<PendingApprovals>("/api/admin/approvals");
      if (!result.ok) throw result.error;
      return result.data;
    },
    refetchInterval: isOnline ? 30_000 : false,
    enabled: isOnline,
  });
}

function useApproveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      id,
      reviewNote,
    }: {
      type: ApprovalType;
      id: number;
      reviewNote?: string;
    }) => {
      const result = await api.post<void>(
        `/api/admin/approvals/${type}/${id}/approve`,
        reviewNote ? { reviewNote } : undefined,
      );
      if (!result.ok) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
  });
}

function useRejectItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      id,
      reviewNote,
    }: {
      type: ApprovalType;
      id: number;
      reviewNote?: string;
    }) => {
      const result = await api.post<void>(
        `/api/admin/approvals/${type}/${id}/reject`,
        reviewNote ? { reviewNote } : undefined,
      );
      if (!result.ok) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
  });
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

function LoadingSkeleton() {
  return (
    <div>
      <div aria-live="polite" className="sr-only">
        Loading approvals...
      </div>
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 rounded-2xl bg-[var(--color-surface-muted)]"
          />
        ))}
      </div>
    </div>
  );
}

interface ApprovalCardProps {
  name: string;
  points: number;
  detail: string;
  submittedAt: string;
  type: ApprovalType;
  id: number;
  approveMutation: ReturnType<typeof useApproveItem>;
  rejectMutation: ReturnType<typeof useRejectItem>;
  isOnline: boolean;
  timezone: string;
}

function ApprovalCard({
  name,
  points,
  detail,
  submittedAt,
  type,
  id,
  approveMutation,
  rejectMutation,
  isOnline,
  timezone,
}: ApprovalCardProps) {
  const [note, setNote] = useState("");
  const [isSlidingOut, setIsSlidingOut] = useState(false);

  const isThisApprovePending =
    approveMutation.isPending &&
    approveMutation.variables?.type === type &&
    approveMutation.variables?.id === id;

  const isThisRejectPending =
    rejectMutation.isPending &&
    rejectMutation.variables?.type === type &&
    rejectMutation.variables?.id === id;

  const isActionPending = isThisApprovePending || isThisRejectPending;

  function handleApprove() {
    approveMutation.mutate(
      { type, id, reviewNote: note.trim() || undefined },
      { onSuccess: () => setIsSlidingOut(true) },
    );
  }

  function handleReject() {
    rejectMutation.mutate(
      { type, id, reviewNote: note.trim() || undefined },
      { onSuccess: () => setIsSlidingOut(true) },
    );
  }

  return (
    <div className={`rounded-2xl bg-[var(--color-surface)] p-4 shadow-card ${isSlidingOut ? "animate-slide-out" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-bold text-[var(--color-text)]">
          {name}
        </h3>
        <span className="shrink-0 font-display font-bold text-[var(--color-amber-700)]">
          {type === "reward-request" ? `-${points}` : `+${points}`} pts
        </span>
      </div>

      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {detail}
        <span className="mx-1.5">&middot;</span>
        {formatTimestamp(submittedAt, DATE_OPTIONS, timezone)}
      </p>

      <label className="mt-3 block">
        <span className="sr-only">Review note for {name}</span>
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleReject}
          disabled={!isOnline || isActionPending}
          title={!isOnline ? "You're offline" : undefined}
          className="min-h-touch rounded-xl px-5 py-2 font-display font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-muted)] transition-colors hover:bg-[var(--color-red-600)] hover:text-white disabled:opacity-50"
        >
          {isThisRejectPending ? "Rejecting..." : "Reject"}
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={!isOnline || isActionPending}
          title={!isOnline ? "You're offline" : undefined}
          className="min-h-touch rounded-xl bg-[var(--color-emerald-500)] px-5 py-2 font-display font-bold text-white transition-colors hover:bg-[var(--color-emerald-600)] disabled:opacity-50"
        >
          {isThisApprovePending ? "Approving..." : "Approve"}
        </button>
      </div>
    </div>
  );
}

interface ApprovalSectionProps {
  title: string;
  borderClass: string;
  children: React.ReactNode;
}

function ApprovalSection({ title, borderClass, children }: ApprovalSectionProps) {
  return (
    <section aria-label={title}>
      <h2
        className={`mb-3 border-l-4 pl-3 font-display text-lg font-semibold text-[var(--color-text-secondary)] ${borderClass}`}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function ApprovalsScreen() {
  const isOnline = useOnline();
  const timezone = useAdminTimezone();
  const { data, isLoading, error, refetch } = usePendingApprovals(isOnline);
  const approveMutation = useApproveItem();
  const rejectMutation = useRejectItem();

  const hasRoutines = data && data.routineCompletions.length > 0;
  const hasChores = data && data.choreLogs.length > 0;
  const hasRewards = data && data.rewardRequests.length > 0;
  const isEmpty = data && !hasRoutines && !hasChores && !hasRewards;

  const mutationError = approveMutation.error || rejectMutation.error;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        Approval Queue
      </h1>

      <div className="mt-6 space-y-6">
        {isLoading && <LoadingSkeleton />}

        {error && (
          <div
            className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card"
            aria-live="assertive"
          >
            <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
              Could not load approvals.
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Please check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
            >
              Try Again
            </button>
          </div>
        )}

        {isEmpty && (
          <div
            className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-card"
            aria-live="polite"
          >
            <p className="text-4xl" data-emoji>
              &#9989;
            </p>
            <p className="mt-3 font-display text-lg font-bold text-[var(--color-text-secondary)]">
              No pending approvals
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              All caught up! New submissions will appear here.
            </p>
          </div>
        )}

        {mutationError && (
          <div
            className="rounded-2xl border border-[var(--color-red-600)] bg-[var(--color-surface)] p-4"
            role="alert"
          >
            <p className="text-sm font-medium text-[var(--color-red-600)]">
              Failed to process approval. Please try again.
            </p>
          </div>
        )}

        {hasRoutines && (
          <ApprovalSection
            title="Routines"
            borderClass="border-l-[var(--color-sky-500)]"
          >
            {data.routineCompletions.map((item: RoutineCompletion) => (
              <ApprovalCard
                key={`routine-${item.id}`}
                name={item.routineNameSnapshot}
                points={item.pointsSnapshot}
                detail={item.timeSlotSnapshot}
                submittedAt={item.completedAt}
                type="routine-completion"
                id={item.id}
                approveMutation={approveMutation}
                rejectMutation={rejectMutation}
                isOnline={isOnline}
                timezone={timezone}
              />
            ))}
          </ApprovalSection>
        )}

        {hasChores && (
          <ApprovalSection
            title="Chores"
            borderClass="border-l-[var(--color-amber-500)]"
          >
            {data.choreLogs.map((item: ChoreLog) => (
              <ApprovalCard
                key={`chore-${item.id}`}
                name={item.choreNameSnapshot}
                points={item.pointsSnapshot}
                detail={item.tierNameSnapshot}
                submittedAt={item.loggedAt}
                type="chore-log"
                id={item.id}
                approveMutation={approveMutation}
                rejectMutation={rejectMutation}
                isOnline={isOnline}
                timezone={timezone}
              />
            ))}
          </ApprovalSection>
        )}

        {hasRewards && (
          <ApprovalSection
            title="Rewards"
            borderClass="border-l-[var(--color-amber-700)]"
          >
            {data.rewardRequests.map((item: RewardRequest) => (
              <ApprovalCard
                key={`reward-${item.id}`}
                name={item.rewardNameSnapshot}
                points={item.costSnapshot}
                detail="Reward redemption"
                submittedAt={item.requestedAt}
                type="reward-request"
                id={item.id}
                approveMutation={approveMutation}
                rejectMutation={rejectMutation}
                isOnline={isOnline}
                timezone={timezone}
              />
            ))}
          </ApprovalSection>
        )}
      </div>
    </div>
  );
}
