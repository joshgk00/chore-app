import { useRoutines } from "./hooks/useRoutines.js";
import { useOnline } from "../../../contexts/OnlineContext.js";
import RoutineCard from "./RoutineCard.js";
import type { Routine, TimeSlot } from "@chore-app/shared";

const SLOT_CONFIG: { slot: TimeSlot; label: string; emoji: string }[] = [
  { slot: "morning", label: "Morning", emoji: "\u{1F305}" },
  { slot: "afternoon", label: "Afternoon", emoji: "\u2600\uFE0F" },
  { slot: "bedtime", label: "Bedtime", emoji: "\u{1F319}" },
  { slot: "anytime", label: "Any Time", emoji: "\u2B50" },
];

export default function RoutinesScreen() {
  const { data: routines, isLoading, error, refetch } = useRoutines();
  const isOnline = useOnline();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold text-gray-800">My Routines</h1>
        <div aria-live="polite" className="sr-only">Loading routines...</div>
        <div className="mt-4 animate-pulse space-y-4">
          <div className="h-6 w-32 rounded-lg bg-gray-200" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div aria-live="assertive" className="text-center">
          <p className="text-xl font-bold text-gray-700">Could not load routines.</p>
          <p className="mt-2 text-gray-600">Please check your connection and try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-6 rounded-full bg-amber-500 px-6 py-3 font-bold text-white shadow-md transition-all duration-200 hover:bg-amber-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const routinesBySlot = new Map<TimeSlot, Routine[]>();
  for (const routine of routines ?? []) {
    const existing = routinesBySlot.get(routine.timeSlot) ?? [];
    existing.push(routine);
    routinesBySlot.set(routine.timeSlot, existing);
  }

  const hasRoutines = (routines ?? []).length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold text-gray-800">My Routines</h1>

      {!isOnline && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 4h.01" />
          </svg>
          <p className="text-sm font-medium">You're offline -- some features may be limited</p>
        </div>
      )}

      {!hasRoutines && (
        <div className="mt-12 text-center" aria-live="polite">
          <p className="text-5xl">&#127775;</p>
          <p className="mt-4 text-xl font-bold text-gray-600">No routines yet!</p>
          <p className="mt-2 text-gray-600">Ask a grown-up to set some up for you.</p>
        </div>
      )}

      <div className="mt-4 space-y-6" aria-live="polite">
        {SLOT_CONFIG.map(({ slot, label, emoji }) => {
          const slotRoutines = routinesBySlot.get(slot);
          if (!slotRoutines || slotRoutines.length === 0) return null;

          return (
            <section key={slot} aria-labelledby={`slot-${slot}`}>
              <h2 id={`slot-${slot}`} className="mb-3 text-lg font-semibold text-gray-700">
                {emoji} {label}
              </h2>
              <div className="space-y-3">
                {slotRoutines.map((routine) => (
                  <RoutineCard key={routine.id} routine={routine} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
