import type { ActivityEvent } from "@chore-app/shared";
import { formatTimestamp } from "../../../lib/format-timestamp.js";

interface RecentActivityProps {
  events: ActivityEvent[];
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

function formatEventTime(createdAt?: string): string {
  if (!createdAt) return "";
  return formatTimestamp(createdAt, DATE_OPTIONS);
}

function getDotColor(eventType: string): string {
  if (eventType.startsWith("routine")) return "bg-[var(--color-sky-500)]";
  if (eventType.startsWith("chore")) return "bg-[var(--color-amber-500)]";
  if (eventType.startsWith("reward")) return "bg-[var(--color-violet-500)]";
  return "bg-[var(--color-text-faint)]";
}

export default function RecentActivity({ events }: RecentActivityProps) {
  if (events.length === 0) {
    return (
      <div className="py-6 text-center" aria-live="polite">
        <p className="text-4xl" data-emoji>&#128203;</p>
        <p className="mt-2 font-display text-base font-semibold text-[var(--color-text-secondary)]">No recent activity yet.</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Complete routines and chores to see your history here.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Recent activity">
      {events.map((event) => (
        <li
          key={`${event.eventType}-${event.entityType}-${event.entityId}-${event.createdAt}`}
          className="flex items-center gap-3 rounded-[14px] bg-[var(--color-surface)] px-4 py-3 shadow-card"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${getDotColor(event.eventType)}`} aria-hidden="true" />
          <span className="flex-1 text-sm font-medium text-[var(--color-text-secondary)]">
            {event.summary ?? event.eventType}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatEventTime(event.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
