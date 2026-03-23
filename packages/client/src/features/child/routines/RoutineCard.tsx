import { Link } from "react-router-dom";
import type { Routine } from "@chore-app/shared";

const SLOT_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  bedtime: "Bedtime",
  anytime: "Any Time",
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
      className="block rounded-2xl bg-white p-4 shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-bold text-gray-800">{routine.name}</h3>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
          {routine.points} {routine.points === 1 ? "pt" : "pts"}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-sm text-gray-600">
          {routine.items.length} {routine.items.length === 1 ? "item" : "items"}
        </span>
        {showSlotBadge && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
            {SLOT_LABELS[routine.timeSlot] ?? routine.timeSlot}
          </span>
        )}
      </div>
    </Link>
  );
}
