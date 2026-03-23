import { useBootstrap } from "./hooks/useBootstrap.js";
import RoutineCard from "../routines/RoutineCard.js";
import QuickChoreLog from "../chores/QuickChoreLog.js";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function TodayScreen() {
  const { data: bootstrap, isLoading, error, refetch } = useBootstrap();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div aria-live="polite" className="sr-only">Loading your routines...</div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-gray-200" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div aria-live="assertive" className="text-center">
          <p className="text-xl font-bold text-gray-700">Could not load your day.</p>
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

  const routines = bootstrap?.routines ?? [];
  const pendingCount = bootstrap?.pendingRoutineCount ?? 0;
  const pendingChoreCount = bootstrap?.pendingChoreCount ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{getGreeting()}!</h1>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all duration-200 hover:bg-gray-200"
          aria-label="Refresh routines"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {routines.length === 0 ? (
        <div className="mt-12 text-center" aria-live="polite">
          <p className="text-5xl">&#127774;</p>
          <p className="mt-4 text-xl font-bold text-gray-600">No routines right now!</p>
          <p className="mt-2 text-gray-600">Check back later.</p>
        </div>
      ) : (
        <div aria-live="polite">
          <div className="mt-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-700">Your Routines</h2>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                {pendingCount} pending
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-4">
            {routines.map((routine) => (
              <RoutineCard key={routine.id} routine={routine} showSlotBadge />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-700">Chores</h2>
          {pendingChoreCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              {pendingChoreCount} pending
            </span>
          )}
        </div>
        <div className="mt-3">
          <QuickChoreLog />
        </div>
      </div>
    </div>
  );
}
