import type { ActivityEvent } from "@chore-app/shared";

interface RecentActivityProps {
  events: ActivityEvent[];
}

function formatEventTime(createdAt?: string): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function RecentActivity({ events }: RecentActivityProps) {
  if (events.length === 0) {
    return (
      <p className="py-4 text-center text-gray-500" aria-live="polite">
        No recent activity yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Recent activity">
      {events.map((event, index) => (
        <li
          key={`${event.entityType}-${event.entityId}-${index}`}
          className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
        >
          <span className="text-sm font-medium text-gray-700">
            {event.summary ?? event.eventType}
          </span>
          <span className="text-xs text-gray-400">
            {formatEventTime(event.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
