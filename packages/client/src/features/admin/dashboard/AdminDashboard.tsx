import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { queryKeys, invalidatePointsRelated } from "../../../lib/query-keys.js";
import { useAdminTimezone } from "../hooks/useAdminTimezone.js";
import { useRoutineHealth } from "../hooks/useRoutineHealth.js";
import { useChoreEngagement } from "../hooks/useChoreEngagement.js";
import { useApprovals } from "../hooks/useApprovals.js";
import { useSystemHealth } from "../hooks/useSystemHealth.js";
import { formatTimestamp } from "../../../lib/format-timestamp.js";
import { formatBytes } from "../utils/format-bytes.js";
import Card from "../../../components/Card.js";
import QuickActionsPanel from "./QuickActionsPanel.js";
import { DATETIME_OPTIONS, DATE_OPTIONS } from "../utils/date-format-options.js";
import { eventTypeDotColor } from "../utils/event-type-colors.js";
import type { ActivityLogResponse, LedgerResponse } from "../types.js";
import type {
  PendingApprovals,
  RoutineCompletion,
  ChoreLog,
  RewardRequest,
  ApprovalType,
  ActivityEventType,
  PointsBalance,
  RoutineHealthAnalytics,
  ChoreEngagementAnalytics,
  SystemHealthStats,
} from "@chore-app/shared";

const RECENT_ACTIVITY_LIMIT = 5;
const APPROVALS_PER_TYPE = 5;

function useDashboardActivity(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.recentActivity(RECENT_ACTIVITY_LIMIT),
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
      queryClient.invalidateQueries({ queryKey: ["admin", "activity-log"] });
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
    <Card as="section" aria-label="Pending approvals">
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
    </Card>
  );
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
    <Card as="section" aria-label="Recent activity">
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
    </Card>
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
    <Card as="section" aria-label="Points balance">
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
    </Card>
  );
}

const MAX_DISPLAYED_CHORES = 4;

function ChoreEngagementCard({
  data,
  isLoading,
  error,
}: {
  data: ChoreEngagementAnalytics | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const topChores = data
    ? data.engagementRates.slice(0, MAX_DISPLAYED_CHORES)
    : [];
  const inactiveCount = data ? data.inactiveChores.length : 0;

  return (
    <Card as="section" aria-label="Chore engagement">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
          Chore Engagement
        </h2>
        {data && inactiveCount > 0 && (
          <span className="rounded-full bg-[var(--color-amber-50)] px-2.5 py-0.5 font-display text-sm font-bold text-[var(--color-amber-700)]">
            {inactiveCount} inactive
          </span>
        )}
      </div>

      {isLoading && (
        <div className="mt-4 animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-4 rounded bg-[var(--color-surface-muted)]"
            />
          ))}
          <div aria-live="polite" className="sr-only">
            Loading chore engagement...
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Could not load chore engagement.
        </p>
      )}

      {data && data.engagementRates.length === 0 && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          No active chores
        </p>
      )}

      {data && data.engagementRates.length > 0 && (
        <div className="mt-3 space-y-2">
          {inactiveCount > 0 && (
            <div className="rounded-lg bg-[var(--color-amber-50)] px-3 py-2">
              <p className="text-xs font-semibold text-[var(--color-amber-700)]">
                {inactiveCount} chore{inactiveCount > 1 ? "s" : ""} with no
                submissions in {data.windowDays} days
              </p>
            </div>
          )}

          {topChores.map((chore) => (
            <div
              key={chore.choreId}
              className="flex items-center justify-between gap-3"
            >
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">
                {chore.choreName}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
                  {chore.submissionCount} log{chore.submissionCount !== 1 ? "s" : ""}
                </span>
                <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                  {chore.totalPoints} pts
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.engagementRates.length > 0 && (
        <Link
          to="/admin/chore-engagement"
          className="mt-4 block text-center text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          View details
        </Link>
      )}
    </Card>
  );
}

const MAX_DISPLAYED_ROUTINES = 4;

function RoutineHealthCard({
  data,
  isLoading,
  error,
}: {
  data: RoutineHealthAnalytics | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const sorted = data
    ? [...data.completionRates].sort(
        (a, b) => a.daysCompleted - b.daysCompleted,
      )
    : [];
  const displayed = sorted.slice(0, MAX_DISPLAYED_ROUTINES);
  const neglectedCount = data
    ? data.completionRates.filter((r) => r.daysCompleted === 0).length
    : 0;

  return (
    <Card as="section" aria-label="Routine health">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
          Routine Health
        </h2>
        {data && data.streakDays > 0 && (
          <span className="rounded-full bg-[var(--color-sky-50)] px-2.5 py-0.5 font-display text-sm font-bold text-[var(--color-sky-700)]">
            {data.streakDays}-day streak
          </span>
        )}
      </div>

      {isLoading && (
        <div className="mt-4 animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-4 rounded bg-[var(--color-surface-muted)]"
            />
          ))}
          <div aria-live="polite" className="sr-only">
            Loading routine health...
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Could not load routine health.
        </p>
      )}

      {data && data.completionRates.length === 0 && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          No active routines
        </p>
      )}

      {data && data.completionRates.length > 0 && (
        <div className="mt-3 space-y-2">
          {neglectedCount > 0 && (
            <div className="rounded-lg bg-[var(--color-amber-50)] px-3 py-2">
              <p className="text-xs font-semibold text-[var(--color-amber-700)]">
                {neglectedCount} routine{neglectedCount > 1 ? "s" : ""} with no
                completions this week
              </p>
            </div>
          )}

          {displayed.map((rate) => (
            <div
              key={rate.routineId}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                  {rate.routineName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-sky-500)] transition-all"
                    style={{
                      width: `${rate.totalDays > 0 ? (rate.daysCompleted / rate.totalDays) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    rate.daysCompleted === 0
                      ? "text-[var(--color-amber-700)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {rate.daysCompleted}/{rate.totalDays}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.completionRates.length > 0 && (
        <Link
          to="/admin/routine-health"
          className="mt-4 block text-center text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          View details
        </Link>
      )}
    </Card>
  );
}

function SystemHealthCard({
  data,
  isLoading,
  error,
  timezone,
}: {
  data: SystemHealthStats | undefined;
  isLoading: boolean;
  error: Error | null;
  timezone: string;
}) {
  return (
    <Card as="section" aria-label="System health">
      <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
        System Health
      </h2>

      {isLoading && (
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-4 w-32 rounded bg-[var(--color-surface-muted)]" />
          <div className="h-4 w-40 rounded bg-[var(--color-surface-muted)]" />
          <div className="h-4 w-28 rounded bg-[var(--color-surface-muted)]" />
          <div aria-live="polite" className="sr-only">
            Loading system health...
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Could not load system health.
        </p>
      )}

      {data && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Database
            </span>
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {formatBytes(data.databaseSizeBytes)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Activity events
            </span>
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {data.activityEventCount.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Push subs (active)
            </span>
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {data.pushSubscriptions.active}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Last backup
            </span>
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {data.lastBackupAt
                ? formatTimestamp(data.lastBackupAt, DATE_OPTIONS, timezone)
                : "Never"}
            </span>
          </div>
        </div>
      )}

      {data && (
        <Link
          to="/admin/system-health"
          className="mt-4 block text-center text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          View details
        </Link>
      )}
    </Card>
  );
}

export default function AdminDashboard() {
  const isOnline = useOnline();
  const timezone = useAdminTimezone();

  const approvals = useApprovals({ isOnline });
  const activity = useDashboardActivity(isOnline);
  const points = useDashboardPoints(isOnline);
  const routineHealth = useRoutineHealth(isOnline);
  const choreEngagement = useChoreEngagement(isOnline);
  const systemHealth = useSystemHealth(isOnline);
  const approveMutation = useDashboardApprove();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        Dashboard
      </h1>

      {!isOnline && !approvals.data && !activity.data && !points.data && (
        <Card className="mt-6 text-center" aria-live="polite">
          <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
            You're offline
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            The dashboard requires an internet connection to load.
          </p>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 tablet:grid-cols-2">
        <div className="tablet:col-span-2">
          <QuickActionsPanel pendingApprovals={approvals.data} />
        </div>

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
          <RoutineHealthCard
            data={routineHealth.data}
            isLoading={routineHealth.isLoading}
            error={routineHealth.error}
          />
        </div>

        <div className="tablet:col-span-2">
          <ChoreEngagementCard
            data={choreEngagement.data}
            isLoading={choreEngagement.isLoading}
            error={choreEngagement.error}
          />
        </div>

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

        <div className="tablet:col-span-2">
          <SystemHealthCard
            data={systemHealth.data}
            isLoading={systemHealth.isLoading}
            error={systemHealth.error}
            timezone={timezone}
          />
        </div>
      </div>
    </div>
  );
}
