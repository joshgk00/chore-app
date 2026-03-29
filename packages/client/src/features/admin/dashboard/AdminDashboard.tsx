import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { queryKeys, invalidatePointsRelated } from "../../../lib/query-keys.js";
import { useAdminTimezone } from "../hooks/useAdminTimezone.js";
import { formatTimestamp } from "../../../lib/format-timestamp.js";
import type {
  PendingApprovals,
  RoutineCompletion,
  ChoreLog,
  RewardRequest,
  ApprovalType,
  ActivityEventType,
  ActivityLogEntry,
  PointsBalance,
  LedgerEntry,
} from "@chore-app/shared";

interface ActivityLogResponse {
  events: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
}

interface LedgerResponse {
  entries: LedgerEntry[];
  balance: PointsBalance;
}

const RECENT_ACTIVITY_LIMIT = 5;
const APPROVALS_PER_TYPE = 5;

const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

function useDashboardApprovals(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.approvals(),
    queryFn: async () => {
      const result = await api.get<PendingApprovals>("/api/admin/approvals");
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isOnline,
  });
}

function useDashboardActivity(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.activityLog("all", "", "", 0),
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(RECENT_ACTIVITY_LIMIT),
        page: "0",
      });
      const result = await api.get<ActivityLogResponse>(
        `/api/admin/activity-log?${params.toString()}`,
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isOnline,
  });
}

function useDashboardPoints(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.ledger(),
    queryFn: async () => {
      const result = await api.get<LedgerResponse>(
        "/api/admin/points/ledger?limit=1",
      );
      if (!result.ok) throw result.error;
      return result.data.balance;
    },
    enabled: isOnline,
  });
}

function useDashboardApprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      id,
    }: {
      type: ApprovalType;
      id: number;
    }) => {
      const result = await api.post<void>(
        `/api/admin/approvals/${type}/${id}/approve`,
      );
      if (!result.ok) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.approvals() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.activityLog("all", "", "", 0) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.ledger() });
      invalidatePointsRelated(queryClient);
    },
  });
}

interface ApprovalItemProps {
  name: string;
  points: number;
  isDeduction: boolean;
  submittedAt: string;
  type: ApprovalType;
  id: number;
  approveMutation: ReturnType<typeof useDashboardApprove>;
  isOnline: boolean;
  timezone: string;
}

function ApprovalItem({
  name,
  points,
  isDeduction,
  submittedAt,
  type,
  id,
  approveMutation,
  isOnline,
  timezone,
}: ApprovalItemProps) {
  const isThisPending =
    approveMutation.isPending &&
    approveMutation.variables?.type === type &&
    approveMutation.variables?.id === id;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text)]">
          {name}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {isDeduction ? `-${points}` : `+${points}`} pts
          <span className="mx-1">&middot;</span>
          {formatTimestamp(submittedAt, DATE_OPTIONS, timezone)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => approveMutation.mutate({ type, id })}
        disabled={!isOnline || isThisPending}
        title={!isOnline ? "You're offline" : undefined}
        className="shrink-0 rounded-lg bg-[var(--color-emerald-500)] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[var(--color-emerald-600)] disabled:opacity-50"
      >
        {isThisPending ? "..." : "Approve"}
      </button>
    </div>
  );
}

interface ApprovalTypeSectionProps {
  label: string;
  dotColor: string;
  items: Array<{
    id: number;
    name: string;
    points: number;
    isDeduction: boolean;
    submittedAt: string;
    type: ApprovalType;
  }>;
  approveMutation: ReturnType<typeof useDashboardApprove>;
  isOnline: boolean;
  timezone: string;
}

function ApprovalTypeSection({
  label,
  dotColor,
  items,
  approveMutation,
  isOnline,
  timezone,
}: ApprovalTypeSectionProps) {
  if (items.length === 0) return null;

  const visible = items.slice(0, APPROVALS_PER_TYPE);
  const overflowCount = items.length - APPROVALS_PER_TYPE;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
      </div>
      {visible.map((item) => (
        <ApprovalItem
          key={`${item.type}-${item.id}`}
          {...item}
          approveMutation={approveMutation}
          isOnline={isOnline}
          timezone={timezone}
        />
      ))}
      {overflowCount > 0 && (
        <Link
          to="/admin/approvals"
          className="mt-1 block text-xs font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          {overflowCount} more &mdash; See all
        </Link>
      )}
    </div>
  );
}

function PendingApprovalsCard({
  data,
  isLoading,
  error,
  isOnline,
  timezone,
  approveMutation,
}: {
  data: PendingApprovals | undefined;
  isLoading: boolean;
  error: Error | null;
  isOnline: boolean;
  timezone: string;
  approveMutation: ReturnType<typeof useDashboardApprove>;
}) {
  const routineItems = (data?.routineCompletions ?? []).map(
    (item: RoutineCompletion) => ({
      id: item.id,
      name: item.routineNameSnapshot,
      points: item.pointsSnapshot,
      isDeduction: false,
      submittedAt: item.completedAt,
      type: "routine-completion" as const,
    }),
  );

  const choreItems = (data?.choreLogs ?? []).map((item: ChoreLog) => ({
    id: item.id,
    name: item.choreNameSnapshot,
    points: item.pointsSnapshot,
    isDeduction: false,
    submittedAt: item.loggedAt,
    type: "chore-log" as const,
  }));

  const rewardItems = (data?.rewardRequests ?? []).map(
    (item: RewardRequest) => ({
      id: item.id,
      name: item.rewardNameSnapshot,
      points: item.costSnapshot,
      isDeduction: true,
      submittedAt: item.requestedAt,
      type: "reward-request" as const,
    }),
  );

  const totalPending =
    routineItems.length + choreItems.length + rewardItems.length;

  return (
    <section
      aria-label="Pending approvals"
      className="rounded-2xl bg-[var(--color-surface)] p-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
          Pending Approvals
        </h2>
        {data && totalPending > 0 && (
          <span className="rounded-full bg-[var(--color-amber-50)] px-2.5 py-0.5 font-display text-sm font-bold text-[var(--color-amber-700)]">
            {totalPending}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="mt-4 animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded bg-[var(--color-surface-muted)]" />
          ))}
          <div aria-live="polite" className="sr-only">Loading approvals...</div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Could not load approvals.
        </p>
      )}

      {approveMutation.error && (
        <div className="mt-3 rounded-lg border border-[var(--color-red-600)] px-3 py-2" role="alert">
          <p className="text-xs font-medium text-[var(--color-red-600)]">
            Approval failed. Please try again.
          </p>
        </div>
      )}

      {data && totalPending === 0 && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Nothing pending
        </p>
      )}

      {data && totalPending > 0 && (
        <div className="mt-3 space-y-3">
          <ApprovalTypeSection
            label="Routines"
            dotColor="bg-[var(--color-sky-500)]"
            items={routineItems}
            approveMutation={approveMutation}
            isOnline={isOnline}
            timezone={timezone}
          />
          <ApprovalTypeSection
            label="Chores"
            dotColor="bg-[var(--color-amber-500)]"
            items={choreItems}
            approveMutation={approveMutation}
            isOnline={isOnline}
            timezone={timezone}
          />
          <ApprovalTypeSection
            label="Rewards"
            dotColor="bg-[var(--color-amber-700)]"
            items={rewardItems}
            approveMutation={approveMutation}
            isOnline={isOnline}
            timezone={timezone}
          />
        </div>
      )}

      {data && totalPending > 0 && (
        <Link
          to="/admin/approvals"
          className="mt-4 block text-center text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          View full queue
        </Link>
      )}
    </section>
  );
}

function eventTypeDotColor(eventType: ActivityEventType): string {
  if (eventType.startsWith("routine_")) return "bg-[var(--color-sky-500)]";
  if (eventType.startsWith("chore_")) return "bg-[var(--color-amber-500)]";
  if (eventType.startsWith("reward_")) return "bg-[var(--color-amber-700)]";
  return "bg-[var(--color-text-muted)]";
}

function RecentActivityCard({
  data,
  isLoading,
  error,
  timezone,
}: {
  data: ActivityLogResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  timezone: string;
}) {
  const events = data?.events ?? [];

  return (
    <section
      aria-label="Recent activity"
      className="rounded-2xl bg-[var(--color-surface)] p-5 shadow-card"
    >
      <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
        Recent Activity
      </h2>

      {isLoading && (
        <div className="mt-4 animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 rounded bg-[var(--color-surface-muted)]" />
          ))}
          <div aria-live="polite" className="sr-only">Loading activity...</div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Could not load activity.
        </p>
      )}

      {data && events.length === 0 && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          No recent activity
        </p>
      )}

      {events.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-2.5">
              <span
                className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${eventTypeDotColor(event.eventType)}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-text)]">
                  {event.summary ?? event.eventType.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {formatTimestamp(event.createdAt, DATETIME_OPTIONS, timezone)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {events.length > 0 && (
        <Link
          to="/admin/activity"
          className="mt-4 block text-center text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          View all activity
        </Link>
      )}
    </section>
  );
}

function PointsBalanceCard({
  data,
  isLoading,
  error,
}: {
  data: PointsBalance | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <section
      aria-label="Points balance"
      className="rounded-2xl bg-[var(--color-surface)] p-5 shadow-card"
    >
      <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
        Points Balance
      </h2>

      {isLoading && (
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-10 w-24 rounded bg-[var(--color-surface-muted)]" />
          <div className="h-4 w-40 rounded bg-[var(--color-surface-muted)]" />
          <div aria-live="polite" className="sr-only">Loading points...</div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Could not load points.
        </p>
      )}

      {data && (
        <div className="mt-3">
          <p className="font-display text-4xl font-bold text-[var(--color-amber-700)]">
            {data.available}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            available points
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--color-text-secondary)]">
                {data.total}
              </span>{" "}
              <span className="text-[var(--color-text-muted)]">earned</span>
            </div>
            <div>
              <span className="font-semibold text-[var(--color-text-secondary)]">
                {data.reserved}
              </span>{" "}
              <span className="text-[var(--color-text-muted)]">reserved</span>
            </div>
          </div>
        </div>
      )}

      {data && (
        <Link
          to="/admin/ledger"
          className="mt-4 block text-center text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          View ledger
        </Link>
      )}
    </section>
  );
}

export default function AdminDashboard() {
  const isOnline = useOnline();
  const timezone = useAdminTimezone();

  const approvals = useDashboardApprovals(isOnline);
  const activity = useDashboardActivity(isOnline);
  const points = useDashboardPoints(isOnline);
  const approveMutation = useDashboardApprove();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        Dashboard
      </h1>

      {!isOnline && !approvals.data && !activity.data && !points.data && (
        <div className="mt-6 rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card" aria-live="polite">
          <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
            You're offline
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            The dashboard requires an internet connection to load.
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 tablet:grid-cols-2">
        <PointsBalanceCard
          data={points.data}
          isLoading={points.isLoading}
          error={points.error}
        />

        <RecentActivityCard
          data={activity.data}
          isLoading={activity.isLoading}
          error={activity.error}
          timezone={timezone}
        />

        <div className="tablet:col-span-2">
          <PendingApprovalsCard
            data={approvals.data}
            isLoading={approvals.isLoading}
            error={approvals.error}
            isOnline={isOnline}
            timezone={timezone}
            approveMutation={approveMutation}
          />
        </div>
      </div>
    </div>
  );
}
