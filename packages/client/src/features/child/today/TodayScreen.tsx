import { useState, useEffect } from "react";
import { useBootstrap } from "./hooks/useBootstrap.js";
import RoutineCard from "../routines/RoutineCard.js";
import QuickChoreLog from "../chores/QuickChoreLog.js";
import PointsBadge from "./PointsBadge.js";
import Mascot from "../../../components/mascot/Mascot.js";
import { determineMascotState, isRecentApproval } from "../../../components/mascot/mascotStates.js";
import { hasAnyActiveDraft } from "../../../lib/draft.js";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function TodayScreen() {
  const { data: bootstrap, isLoading, error, refetch } = useBootstrap();

  const [hasActiveDraft, setHasActiveDraft] = useState(false);
  useEffect(() => {
    hasAnyActiveDraft().then(setHasActiveDraft).catch(() => {});
  }, [bootstrap]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] p-4">
        <div aria-live="polite" className="sr-only">Loading your routines...</div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-[var(--color-surface-muted)]" />
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[72px] rounded-3xl bg-[var(--color-surface-muted)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] p-4">
        <div aria-live="assertive" className="text-center">
          <p className="font-display text-xl font-bold text-[var(--color-text)]">Could not load your day.</p>
          <p className="mt-2 text-[var(--color-text-muted)]">Please check your connection and try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-6 rounded-full bg-[var(--color-amber-500)] px-6 py-3 font-display font-bold text-white shadow-card transition-all duration-200 hover:bg-[var(--color-amber-600)]"
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
  const hasPendingApprovals = pendingCount > 0 || pendingChoreCount > 0 || (bootstrap?.pendingRewardCount ?? 0) > 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const hasBadgeEarnedToday = (bootstrap?.recentBadges ?? []).some(
    (b) => new Date(b.earnedAt) >= todayStart,
  );

  const hasRecentApproval = isRecentApproval(bootstrap?.lastApprovalAt);

  const mascotState = determineMascotState({
    hasBadgeOrRewardApproval: hasBadgeEarnedToday,
    hasRecentApproval,
    hasPendingApprovals,
    hasActiveDraft,
    slotConfig: bootstrap?.slotConfig,
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Mascot state={mascotState} size={48} />
          <div>
            <h1 className="font-display text-[28px] font-bold text-[var(--color-text)]">{getGreeting()}!</h1>
            <p className="mt-0.5 text-[15px] text-[var(--color-text-muted)]">Let's get some things done</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bootstrap?.pointsSummary && (
            <PointsBadge balance={bootstrap.pointsSummary} />
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] transition-all duration-200 hover:bg-[var(--color-border)]"
            aria-label="Refresh routines"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {routines.length === 0 ? (
        <div className="mt-12 text-center" aria-live="polite">
          <p className="text-5xl" data-emoji>&#127774;</p>
          <p className="mt-4 font-display text-xl font-bold text-[var(--color-text-secondary)]">No routines right now!</p>
          <p className="mt-2 text-[var(--color-text-muted)]">Check back later.</p>
        </div>
      ) : (
        <div aria-live="polite">
          <div className="mt-5 flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">Your Routines</h2>
            {pendingCount > 0 && (
              <span className="rounded-full bg-[var(--color-amber-100)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-amber-700)]">
                {pendingCount} pending
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-3">
            {routines.map((routine) => (
              <RoutineCard key={routine.id} routine={routine} showSlotBadge />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">Chores</h2>
          {pendingChoreCount > 0 && (
            <span className="rounded-full bg-[var(--color-amber-100)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-amber-700)]">
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
