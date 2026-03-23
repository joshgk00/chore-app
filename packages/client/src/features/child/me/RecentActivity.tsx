import type { ActivityEvent } from "@chore-app/shared";

interface RecentActivityProps {
  events: ActivityEvent[];
}

function formatEventTime(createdAt?: string): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getDotColor(eventType: string): string {
  if (eventType.startsWith("routine")) return "bg-sky-500";
  if (eventType.startsWith("chore")) return "bg-amber-500";
  if (eventType.startsWith("reward")) return "bg-violet-500";
  return "bg-[var(--color-text-faint)]";
}

export default function RecentActivity({ events }: RecentActivityProps) {
  if (events.length === 0) {
    return (
      <p className="py-4 text-center text-[var(--color-text-muted)]" aria-live="polite">
        No recent activity yet.
      </p>
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
