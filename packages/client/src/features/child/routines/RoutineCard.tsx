import { Link } from "react-router-dom";
import type { Routine } from "@chore-app/shared";

const SLOT_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  bedtime: "Bedtime",
  anytime: "Any Time",
};

const SLOT_EMOJI: Record<string, string> = {
  morning: "\uD83C\uDF05",
  afternoon: "\u2600\uFE0F",
  bedtime: "\uD83C\uDF19",
  anytime: "\u2B50",
};

interface Props {
  routine: Routine;
  showSlotBadge?: boolean;
}

export default function RoutineCard({ routine, showSlotBadge }: Props) {
  return (
    <Link
      to={`/routines/${routine.id}`}
      aria-label={`Go to ${routine.name}`}
      className="flex items-center gap-3.5 rounded-3xl border-l-4 border-l-sky-500 bg-[var(--color-surface)] p-4 shadow-card transition-all duration-200 hover:translate-y-[-1px] hover:shadow-elevated active:scale-[0.98] dark:border-l-sky-400"
    >
      {routine.imageUrl ? (
        <img
          src={routine.imageUrl}
          alt={routine.name}
          className="h-11 w-11 shrink-0 rounded-[14px] object-cover"
        />
      ) : (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-sky-50)] text-xl"
          data-emoji
        >
          {SLOT_EMOJI[routine.timeSlot] ?? "\u2B50"}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base font-semibold text-[var(--color-text)]">
          {routine.name}
        </h3>
        <div className="mt-0.5 flex items-center gap-2.5">
          <span className="text-[13px] text-[var(--color-text-muted)]">
            {routine.items.length} {routine.items.length === 1 ? "item" : "items"}
          </span>
          {showSlotBadge && (
            <span className="rounded-full bg-[var(--color-sky-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-sky-700)]">
              {SLOT_LABELS[routine.timeSlot] ?? routine.timeSlot}
            </span>
          )}
        </div>
      </div>

      <span className="shrink-0 rounded-full border-[1.5px] border-amber-200 bg-[var(--color-amber-50)] px-3 py-1 font-display text-sm font-bold text-[var(--color-amber-700)] dark:border-amber-700">
        {routine.points} {routine.points === 1 ? "pt" : "pts"}
      </span>
    </Link>
  );
}
