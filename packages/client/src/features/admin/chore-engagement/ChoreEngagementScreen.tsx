import { Link } from "react-router-dom";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { useChoreEngagement } from "../hooks/useChoreEngagement.js";
import { formatCalendarDate } from "../../../lib/format-timestamp.js";
import Card from "../../../components/Card.js";
import { DATE_OPTIONS } from "../utils/date-format-options.js";

function TrendBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-amber-500)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums text-[var(--color-text-secondary)]">
        {value}
      </span>
    </div>
  );
}

export default function ChoreEngagementScreen() {
  const isOnline = useOnline();
  const {
    data: engagement,
    isLoading,
    error,
    refetch,
  } = useChoreEngagement(isOnline);

  const totalSubmissions = engagement
    ? engagement.engagementRates.reduce((sum, r) => sum + r.submissionCount, 0)
    : 0;

  const maxTrendValue = engagement
    ? Math.max(...engagement.submissionTrends.map((t) => t.submissions), 1)
    : 1;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin"
          className="text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          Dashboard
        </Link>
        <span className="text-[var(--color-text-muted)]">/</span>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
          Chore Engagement
        </h1>
      </div>

      {!isOnline && !engagement && !isLoading && (
        <Card padding="p-6" className="text-center" aria-live="polite">
          <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
            You're offline
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Chore engagement data requires an internet connection.
          </p>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-5">
          <div aria-live="polite" className="sr-only">
            Loading chore engagement...
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-16 rounded-2xl bg-[var(--color-surface-muted)]" />
            <div className="h-48 rounded-2xl bg-[var(--color-surface-muted)]" />
            <div className="h-32 rounded-2xl bg-[var(--color-surface-muted)]" />
          </div>
        </div>
      )}

      {error && (
        <Card padding="p-6" className="text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Could not load chore engagement data.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card"
          >
            Try Again
          </button>
        </Card>
      )}

      {engagement && (
        <div className="space-y-5">
          <Card as="section" aria-label="Summary">
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl font-bold text-[var(--color-amber-700)]">
                {totalSubmissions}
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-[var(--color-text)]">
                  submission{totalSubmissions !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  in the last {engagement.windowDays} days
                </p>
              </div>
            </div>
          </Card>

          {engagement.inactiveChores.length > 0 && (
            <section
              aria-label="Inactive chores"
              className="rounded-2xl border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] p-5 shadow-card"
            >
              <h2 className="font-display text-lg font-semibold text-[var(--color-amber-700)]">
                Inactive Chores
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                No submissions in the last {engagement.windowDays} days
              </p>
              <ul className="mt-3 space-y-2">
                {engagement.inactiveChores.map((chore) => (
                  <li key={chore.choreId}>
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {chore.choreName}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Card as="section" aria-label="Chore rankings">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
              Chore Rankings
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Last {engagement.windowDays} days, sorted by submissions
            </p>

            {engagement.engagementRates.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                No active chores
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {engagement.engagementRates.map((rate) => (
                  <div
                    key={rate.choreId}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">
                      {rate.choreName}
                    </p>
                    <div className="flex items-center gap-4 text-xs tabular-nums">
                      <span
                        className={`font-semibold ${
                          rate.submissionCount === 0
                            ? "text-[var(--color-amber-700)]"
                            : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {rate.submissionCount} log{rate.submissionCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {rate.approvedCount} approved
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {rate.totalPoints} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {engagement.submissionTrends.length > 0 && (
            <Card as="section" aria-label="Submission trends">
              <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
                Daily Submissions
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Activity over the last {engagement.windowDays} days
              </p>
              <div className="mt-4 space-y-2">
                {engagement.submissionTrends.map((trend) => (
                  <div
                    key={trend.date}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="w-16 shrink-0 text-xs text-[var(--color-text-muted)]">
                      {formatCalendarDate(trend.date, DATE_OPTIONS)}
                    </span>
                    <TrendBar value={trend.submissions} max={maxTrendValue} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
