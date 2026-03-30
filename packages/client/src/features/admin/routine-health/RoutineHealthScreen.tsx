import { Link } from "react-router-dom";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { useRoutineHealth } from "../hooks/useRoutineHealth.js";
import Card from "../../../components/Card.js";
import type { TimeSlot } from "@chore-app/shared";

const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  bedtime: "Bedtime",
  anytime: "Any Time",
};

function SlotBadge({ slot }: { slot: TimeSlot }) {
  return (
    <span className="inline-block rounded-full bg-[var(--color-sky-50)] px-2 py-0.5 text-xs font-semibold text-[var(--color-sky-700)]">
      {SLOT_LABELS[slot]}
    </span>
  );
}

function CompletionBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-sky-500)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          completed === 0
            ? "text-[var(--color-amber-700)]"
            : "text-[var(--color-text-secondary)]"
        }`}
      >
        {completed}/{total}
      </span>
    </div>
  );
}

export default function RoutineHealthScreen() {
  const isOnline = useOnline();
  const {
    data: routineHealth,
    isLoading,
    error,
    refetch,
  } = useRoutineHealth(isOnline);
  const neglectedRoutines = routineHealth
    ? routineHealth.completionRates.filter((r) => r.daysCompleted === 0)
    : [];

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
          Routine Health
        </h1>
      </div>

      {!isOnline && !routineHealth && !isLoading && (
        <Card padding="p-6" className="text-center" aria-live="polite">
          <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
            You're offline
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Routine health data requires an internet connection.
          </p>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-5">
          <div aria-live="polite" className="sr-only">
            Loading routine health...
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
            Could not load routine health data.
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

      {routineHealth && (
        <div className="space-y-5">
          <Card as="section" aria-label="Streak">
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl font-bold text-[var(--color-sky-700)]">
                {routineHealth.streakDays}
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-[var(--color-text)]">
                  day streak
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  consecutive days with at least one routine completed
                </p>
              </div>
            </div>
          </Card>

          {neglectedRoutines.length > 0 && (
            <section
              aria-label="Needs attention"
              className="rounded-2xl border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] p-5 shadow-card"
            >
              <h2 className="font-display text-lg font-semibold text-[var(--color-amber-700)]">
                Needs Attention
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                No completions in the last 7 days
              </p>
              <ul className="mt-3 space-y-2">
                {neglectedRoutines.map((r) => (
                  <li key={r.routineId} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {r.routineName}
                    </span>
                    <SlotBadge slot={r.timeSlot} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Card as="section" aria-label="Completion rates">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
              Completion Rates
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Last 7 days
            </p>

            {routineHealth.completionRates.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                No active routines
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {routineHealth.completionRates.map((rate) => (
                  <div
                    key={rate.routineId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--color-text)]">
                        {rate.routineName}
                      </p>
                      <SlotBadge slot={rate.timeSlot} />
                    </div>
                    <CompletionBar
                      completed={rate.daysCompleted}
                      total={rate.totalDays}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {routineHealth.timeSlotBreakdown.length > 0 && (
            <Card as="section" aria-label="Time slot breakdown">
              <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
                By Time Slot
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Completions per slot in the last 7 days
              </p>
              <div className="mt-4 space-y-3">
                {routineHealth.timeSlotBreakdown.map((slot) => (
                  <div
                    key={slot.timeSlot}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <SlotBadge slot={slot.timeSlot} />
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {slot.routineCount} routine
                        {slot.routineCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
                      {slot.completedCount}
                    </span>
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
