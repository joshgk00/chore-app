import { useRewards } from "./hooks/useRewards.js";
import { usePoints } from "./hooks/usePoints.js";
import PointsDisplay from "./PointsDisplay.js";
import RewardCard from "./RewardCard.js";

export default function RewardsScreen() {
  const { data: rewards, isLoading: isLoadingRewards, error: rewardsError } = useRewards();
  const { data: points, isLoading: isLoadingPoints, error: pointsError } = usePoints();

  const isLoading = isLoadingRewards || isLoadingPoints;
  const error = rewardsError || pointsError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div aria-live="polite" className="sr-only">Loading rewards...</div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-2xl bg-gray-200" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-gray-200" />
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
          <p className="text-xl font-bold text-gray-700">Could not load rewards.</p>
          <p className="mt-2 text-gray-600">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const rewardList = rewards ?? [];
  const balance = points ?? { total: 0, reserved: 0, available: 0 };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold text-gray-800">Rewards</h1>

      <div className="mt-4">
        <PointsDisplay balance={balance} />
      </div>

      {rewardList.length === 0 ? (
        <div className="mt-12 text-center" aria-live="polite">
          <p className="text-xl font-bold text-gray-600">No rewards available yet.</p>
          <p className="mt-2 text-gray-500">Keep earning points!</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {rewardList.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              availablePoints={balance.available}
            />
          ))}
        </div>
      )}
    </div>
  );
}
