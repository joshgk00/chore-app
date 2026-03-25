import { useState, useRef, useMemo, useEffect } from "react";
import { usePoints } from "../rewards/hooks/usePoints.js";
import { useBadges } from "./hooks/useBadges.js";
import { useRecentActivity } from "./hooks/useRecentActivity.js";
import { useBootstrap } from "../today/hooks/useBootstrap.js";
import PointsDisplay from "../rewards/PointsDisplay.js";
import BadgeCollection from "../../../components/badges/BadgeCollection.js";
import RecentActivity from "./RecentActivity.js";
import NotificationOptIn from "./NotificationOptIn.js";
import Mascot from "../../../components/mascot/Mascot.js";
import { determineMascotState } from "../../../components/mascot/mascotStates.js";
import { hasAnyActiveDraft } from "../../../lib/draft.js";

export default function MeScreen() {
  const { data: points, isLoading: isLoadingPoints, error: pointsError, refetch: refetchPoints } = usePoints();
  const { data: badges, isLoading: isLoadingBadges, error: badgesError, refetch: refetchBadges } = useBadges();
  const { data: activity, isLoading: isLoadingActivity, error: activityError, refetch: refetchActivity } = useRecentActivity();
  const { data: bootstrap } = useBootstrap();

  const [hasActiveDraft, setHasActiveDraft] = useState(false);
  useEffect(() => {
    hasAnyActiveDraft().then(setHasActiveDraft).catch(() => {});
  }, [badges]);

  const previousBadgeKeysRef = useRef<Set<string>>(new Set());
  const newlyEarnedKeys = useMemo(() => {
    if (!badges) return new Set<string>();
    const currentKeys = new Set(badges.map((b) => b.badgeKey));
    const newKeys = new Set<string>();
    for (const key of currentKeys) {
      if (!previousBadgeKeysRef.current.has(key)) {
        newKeys.add(key);
      }
    }
    const isInitialLoad = previousBadgeKeysRef.current.size === 0;
    return isInitialLoad ? new Set<string>() : newKeys;
  }, [badges]);

  // Ref update must live in useEffect — mutating refs inside useMemo breaks Strict Mode double-render
  useEffect(() => {
    if (badges) {
      previousBadgeKeysRef.current = new Set(badges.map((b) => b.badgeKey));
    }
  }, [badges]);

  const isLoading = isLoadingPoints || isLoadingBadges || isLoadingActivity;
  const error = pointsError || badgesError || activityError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] p-4">
        <div aria-live="polite" className="sr-only">Loading your profile...</div>
        <div className="animate-pulse space-y-4">
          <div className="h-28 rounded-3xl bg-[var(--color-surface-muted)]" />
          <div className="h-36 rounded-3xl bg-[var(--color-surface-muted)]" />
          <div className="h-48 rounded-3xl bg-[var(--color-surface-muted)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] p-4">
        <div aria-live="assertive" className="text-center">
          <p className="font-display text-xl font-bold text-[var(--color-text)]">Could not load your profile.</p>
          <p className="mt-2 text-[var(--color-text-muted)]">Please check your connection and try again.</p>
          <button
            type="button"
            onClick={() => { refetchPoints(); refetchBadges(); refetchActivity(); }}
            className="mt-6 rounded-full bg-[var(--color-amber-500)] px-6 py-3 font-display font-bold text-white shadow-card transition-all duration-200 hover:bg-[var(--color-amber-600)]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const balance = points ?? { total: 0, reserved: 0, available: 0 };
  const earnedBadges = badges ?? [];
  const recentEvents = activity ?? [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const hasBadgeEarnedToday = earnedBadges.some(
    (b) => new Date(b.earnedAt) >= todayStart,
  );

  const pendingCount = (bootstrap?.pendingRoutineCount ?? 0) + (bootstrap?.pendingChoreCount ?? 0) + (bootstrap?.pendingRewardCount ?? 0);

  const mascotState = determineMascotState({
    hasBadgeOrRewardApproval: hasBadgeEarnedToday,
    hasPendingApprovals: pendingCount > 0,
    hasActiveDraft,
    slotConfig: bootstrap?.slotConfig,
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-4">
      <div className="flex items-center gap-3">
        <Mascot state={mascotState} size={56} />
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Me</h1>
      </div>

      <div className="mt-4">
        <PointsDisplay balance={balance} />
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">Badges</h2>
        <div className="mt-3 rounded-3xl bg-[var(--color-surface)] p-4 shadow-card">
          <BadgeCollection earnedBadges={earnedBadges} newlyEarnedKeys={newlyEarnedKeys} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">Recent Activity</h2>
        <div className="mt-3">
          <RecentActivity events={recentEvents} />
        </div>
      </div>

      <div className="mt-8">
        <NotificationOptIn />
      </div>
    </div>
  );
}
