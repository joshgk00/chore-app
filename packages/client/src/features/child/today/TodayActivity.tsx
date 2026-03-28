import type { TodayPointActivity, EntryType } from "@chore-app/shared";

const DOT_COLORS: Record<EntryType, string> = {
  routine: "bg-[var(--color-sky-400)]",
  chore: "bg-[var(--color-amber-500)]",
  reward: "bg-[var(--color-amber-500)]",
  manual: "bg-[var(--color-text-muted)]",
  bonus: "bg-[var(--color-amber-500)]",
};

interface TodayActivityProps {
  activities: TodayPointActivity[];
}

export default function TodayActivity({ activities }: TodayActivityProps) {
  if (activities.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">
        Today's Activity
      </h2>
      <ul className="mt-3 space-y-2" aria-label="Today's point activity">
        {activities.map((activity) => (
          <li
            key={activity.id}
            className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface)] px-4 py-3 shadow-card"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLORS[activity.entryType]}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] text-[var(--color-text)]">
                {activity.description}
              </p>
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {activity.balanceBefore} → {activity.balanceAfter} pts
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 font-display text-[13px] font-bold ${
                activity.amount >= 0
                  ? "bg-[var(--color-emerald-50)] text-[var(--color-emerald-700)]"
                  : "bg-[var(--color-red-50)] text-[var(--color-red-600)]"
              }`}
            >
              {activity.amount >= 0 ? `+${activity.amount}` : activity.amount}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
