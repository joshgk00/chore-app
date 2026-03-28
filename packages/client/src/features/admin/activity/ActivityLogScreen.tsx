import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { queryKeys } from "../../../lib/query-keys.js";
import { useAdminTimezone } from "../hooks/useAdminTimezone.js";
import { formatTimestamp } from "../../../lib/format-timestamp.js";
import { ACTIVITY_EVENT_TYPES } from "@chore-app/shared";
import type { ActivityLogEntry } from "@chore-app/shared";

const PAGE_SIZE = 50;

type FilterEventType = "all" | (typeof ACTIVITY_EVENT_TYPES)[number];

interface ActivityLogResponse {
  events: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
}

function formatEventTypeLabel(eventType: string): string {
  return eventType.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function eventTypeBadgeColor(eventType: string): string {
  if (eventType.startsWith("routine_")) {
    return "bg-[var(--color-sky-50)] text-[var(--color-sky-700)]";
  }
  if (eventType.startsWith("chore_") || eventType.startsWith("reward_")) {
    return "bg-[var(--color-amber-50)] text-[var(--color-amber-700)]";
  }
  return "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]";
}

function EventTypeBadge({ eventType }: { eventType: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${eventTypeBadgeColor(eventType)}`}
    >
      {formatEventTypeLabel(eventType)}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div aria-live="polite" className="sr-only">
        Loading activity log...
      </div>
      <div className="animate-pulse space-y-4">
        <div className="flex gap-3">
          <div className="h-10 w-40 rounded-lg bg-[var(--color-surface-muted)]" />
          <div className="h-10 w-36 rounded-lg bg-[var(--color-surface-muted)]" />
          <div className="h-10 w-36 rounded-lg bg-[var(--color-surface-muted)]" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-[var(--color-surface-muted)]"
          />
        ))}
      </div>
    </div>
  );
}

export default function ActivityLogScreen() {
  const isOnline = useOnline();
  const timezone = useAdminTimezone();
  const [eventTypeFilter, setEventTypeFilter] = useState<FilterEventType>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: queryKeys.admin.activityLog(eventTypeFilter, startDate, endDate, page),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (eventTypeFilter !== "all") {
        params.set("event_type", eventTypeFilter);
      }
      if (startDate) {
        params.set("start_date", startDate);
      }
      if (endDate) {
        params.set("end_date", endDate);
      }
      const result = await api.get<ActivityLogResponse>(
        `/api/admin/activity-log?${params.toString()}`,
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
  });

  const events = query.data?.events ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasEvents = events.length > 0;
  const isEmpty = !query.isLoading && !query.error && events.length === 0;

  function handleEventTypeChange(value: string) {
    setEventTypeFilter(value as FilterEventType);
    setPage(0);
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    setPage(0);
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    setPage(0);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
        Activity Log
      </h1>

      <div className="mt-6 space-y-6">
        {query.isLoading && <LoadingSkeleton />}

        <div aria-live="polite">
          {!isOnline && !query.data && !query.isLoading && (
            <div className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card">
              <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
                You're offline
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                The activity log requires an internet connection to load.
              </p>
            </div>
          )}
        </div>

        {isOnline && query.error && (
          <div
            className="rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-card"
            aria-live="assertive"
          >
            <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
              Could not load the activity log.
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Please check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-4 min-h-touch rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card transition-colors hover:bg-[var(--color-amber-600)]"
            >
              Try Again
            </button>
          </div>
        )}

        {!query.isLoading && !query.error && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="activity-event-type"
                  className="block text-xs font-semibold text-[var(--color-text-muted)]"
                >
                  Event type
                </label>
                <select
                  id="activity-event-type"
                  value={eventTypeFilter}
                  onChange={(e) => handleEventTypeChange(e.target.value)}
                  className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
                >
                  <option value="all">All types</option>
                  {ACTIVITY_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEventTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="activity-start-date"
                  className="block text-xs font-semibold text-[var(--color-text-muted)]"
                >
                  Start date
                </label>
                <input
                  id="activity-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
                />
              </div>
              <div>
                <label
                  htmlFor="activity-end-date"
                  className="block text-xs font-semibold text-[var(--color-text-muted)]"
                >
                  End date
                </label>
                <input
                  id="activity-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-amber-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber-500)]"
                />
              </div>
            </div>

            {hasEvents && (
              <div className="overflow-x-auto rounded-2xl bg-[var(--color-surface)] shadow-card">
                <table className="w-full text-sm" aria-label="Activity log entries">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th
                        scope="col"
                        className="px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
                      >
                        Event
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
                      >
                        Summary
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr
                        key={event.id}
                        className="border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                          {formatTimestamp(event.createdAt, DATE_TIME_OPTIONS, timezone)}
                        </td>
                        <td className="px-4 py-3">
                          <EventTypeBadge eventType={event.eventType} />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">
                          {event.summary ?? "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isEmpty && (
              <div
                className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-card"
                aria-live="polite"
              >
                <p className="text-4xl" data-emoji>
                  &#128203;
                </p>
                <p className="mt-3 font-display text-lg font-bold text-[var(--color-text-secondary)]">
                  No activity found
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Activity from routines, chores, and rewards will appear here.
                </p>
              </div>
            )}

            {hasEvents && (
              <div className="flex items-center justify-center gap-3">
                {page > 0 && (
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="min-h-touch rounded-xl bg-[var(--color-surface-muted)] px-5 py-2 font-display font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
                  >
                    Previous
                  </button>
                )}
                <span className="text-sm text-[var(--color-text-muted)]">
                  Page {page + 1} of {totalPages}
                </span>
                {page + 1 < totalPages && (
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="min-h-touch rounded-xl bg-[var(--color-surface-muted)] px-5 py-2 font-display font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
                  >
                    Next
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
