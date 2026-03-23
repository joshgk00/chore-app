import { usePoints } from "../rewards/hooks/usePoints.js";
import { useBadges } from "./hooks/useBadges.js";
import { useActivity } from "./hooks/useActivity.js";
import PointsDisplay from "../rewards/PointsDisplay.js";
import BadgeCollection from "../../../components/badges/BadgeCollection.js";
import RecentActivity from "./RecentActivity.js";
import NotificationOptIn from "./NotificationOptIn.js";

export default function MeScreen() {
  const { data: points, isLoading: isLoadingPoints } = usePoints();
  const { data: badges, isLoading: isLoadingBadges } = useBadges();
  const { data: activity, isLoading: isLoadingActivity } = useActivity();

  const isLoading = isLoadingPoints || isLoadingBadges || isLoadingActivity;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div aria-live="polite" className="sr-only">Loading your profile...</div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-2xl bg-gray-200" />
          <div className="h-32 rounded-2xl bg-gray-200" />
          <div className="h-48 rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  const balance = points ?? { total: 0, reserved: 0, available: 0 };
  const earnedBadges = badges ?? [];
  const recentEvents = activity ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold text-gray-800">Me</h1>

      <div className="mt-4">
        <PointsDisplay balance={balance} />
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-700">Badges</h2>
        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <BadgeCollection earnedBadges={earnedBadges} />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center rounded-2xl bg-amber-50 p-6">
        <div className="text-center">
          <p className="text-5xl" aria-hidden="true">{"\uD83E\uDD16"}</p>
          <p className="mt-2 text-sm font-medium text-amber-700">Mascot coming soon!</p>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-700">Recent Activity</h2>
        <div className="mt-3">
          <RecentActivity events={recentEvents} />
        </div>
      </div>

      <div className="mt-6">
        <NotificationOptIn />
      </div>
    </div>
  );
}
