import { useRewards } from "./hooks/useRewards.js";
import { usePoints } from "./hooks/usePoints.js";
import PointsDisplay from "./PointsDisplay.js";
import RewardCard from "./RewardCard.js";

export default function RewardsScreen() {
  const { data: rewards, isLoading: isLoadingRewards, error: rewardsError, refetch: refetchRewards } = useRewards();
  const { data: points, isLoading: isLoadingPoints, error: pointsError, refetch: refetchPoints } = usePoints();

  const isLoading = isLoadingRewards || isLoadingPoints;
  const error = rewardsError || pointsError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] p-4">
        <div aria-live="polite" className="sr-only">Loading rewards...</div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-3xl bg-[var(--color-border)]" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 rounded-3xl bg-[var(--color-border)]" />
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
          <p className="text-xl font-bold text-[var(--color-text-secondary)]">Could not load rewards.</p>
          <p className="mt-2 text-[var(--color-text-muted)]">Please check your connection and try again.</p>
          <button
            type="button"
            onClick={() => { refetchRewards(); refetchPoints(); }}
            className="mt-6 rounded-full bg-[var(--color-amber-500)] px-6 py-3 font-display font-bold text-white shadow-card transition-all duration-200 hover:bg-[var(--color-amber-600)]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const rewardList = rewards ?? [];
  const balance = points ?? { total: 0, reserved: 0, available: 0 };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-4">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Rewards</h1>

      <div className="mt-4">
        <PointsDisplay balance={balance} />
      </div>

      {rewardList.length === 0 ? (
        <div className="mt-12 text-center" aria-live="polite">
          <p className="text-4xl" data-emoji>&#127873;</p>
          <p className="mt-2 text-xl font-bold text-[var(--color-text-muted)]">No rewards available yet.</p>
          <p className="mt-1 text-[var(--color-text-muted)]">Keep earning points!</p>
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
