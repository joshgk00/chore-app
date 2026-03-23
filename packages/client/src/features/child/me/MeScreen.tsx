import { usePoints } from "../rewards/hooks/usePoints.js";
import { useBadges } from "./hooks/useBadges.js";
import { useRecentActivity } from "./hooks/useRecentActivity.js";
import PointsDisplay from "../rewards/PointsDisplay.js";
import BadgeCollection from "../../../components/badges/BadgeCollection.js";
import RecentActivity from "./RecentActivity.js";
import NotificationOptIn from "./NotificationOptIn.js";

export default function MeScreen() {
  const { data: points, isLoading: isLoadingPoints, error: pointsError, refetch: refetchPoints } = usePoints();
  const { data: badges, isLoading: isLoadingBadges, error: badgesError, refetch: refetchBadges } = useBadges();
  const { data: activity, isLoading: isLoadingActivity, error: activityError, refetch: refetchActivity } = useRecentActivity();

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
            className="mt-6 rounded-full bg-amber-500 px-6 py-3 font-display font-bold text-white shadow-md transition-all duration-200 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
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

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-4">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Me</h1>

      <div className="mt-4">
        <PointsDisplay balance={balance} />
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-[var(--color-text-secondary)]">Badges</h2>
        <div className="mt-3 rounded-3xl bg-[var(--color-surface)] p-4 shadow-card">
          <BadgeCollection earnedBadges={earnedBadges} />
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-center rounded-3xl border-[1.5px] border-[var(--color-amber-100)] bg-[var(--color-amber-50)] p-6">
          <div className="text-center">
            <p className="text-[56px] leading-none" data-emoji aria-hidden="true">{"\uD83E\uDD16"}</p>
            <p className="mt-2 font-display text-sm font-medium text-[var(--color-amber-700)]">Mascot coming soon!</p>
          </div>
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
