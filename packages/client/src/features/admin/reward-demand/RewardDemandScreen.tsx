import { Link } from "react-router-dom";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { useRewardDemand } from "../hooks/useRewardDemand.js";
import Card from "../../../components/Card.js";

function RedemptionRatioBar({ earned, redeemed }: { earned: number; redeemed: number }) {
  const pct = earned > 0 ? (redeemed / earned) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-amber-500)] transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums text-[var(--color-text-secondary)]">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export default function RewardDemandScreen() {
  const isOnline = useOnline();
  const {
    data: demand,
    isLoading,
    error,
    refetch,
  } = useRewardDemand(isOnline);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin"
          className="text-sm font-semibold text-[var(--color-amber-700)] hover:underline"
        >
          Dashboard
        </Link>
        <span className="text-[var(--color-text-muted)]">/</span>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">
          Reward Demand
        </h1>
      </div>

      {!isOnline && !demand && !isLoading && (
        <Card padding="p-6" className="text-center" aria-live="polite">
          <p className="font-display text-lg font-bold text-[var(--color-text-secondary)]">
            You're offline
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Reward demand data requires an internet connection.
          </p>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-5">
          <div aria-live="polite" className="sr-only">
            Loading reward demand...
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-16 rounded-2xl bg-[var(--color-surface-muted)]" />
            <div className="h-48 rounded-2xl bg-[var(--color-surface-muted)]" />
            <div className="h-32 rounded-2xl bg-[var(--color-surface-muted)]" />
          </div>
        </div>
      )}

      {error && (
        <Card padding="p-6" className="text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Could not load reward demand data.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-[var(--color-amber-500)] px-5 py-2 font-display font-bold text-white shadow-card"
          >
            Try Again
          </button>
        </Card>
      )}

      {demand && (
        <div className="space-y-5">
          <Card as="section" aria-label="Pending requests">
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl font-bold text-[var(--color-amber-700)]">
                {demand.pendingCount}
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-[var(--color-text)]">
                  pending request{demand.pendingCount !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {demand.pendingTotalCost} points reserved
                </p>
              </div>
            </div>
          </Card>

          <Card as="section" aria-label="Redemption ratio">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
              Points Redeemed vs. Earned
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {demand.pointsRedeemed} redeemed of {demand.pointsEarned} earned
            </p>
            <div className="mt-3">
              <RedemptionRatioBar
                earned={demand.pointsEarned}
                redeemed={demand.pointsRedeemed}
              />
            </div>
          </Card>

          {demand.neverRequested.length > 0 && (
            <section
              aria-label="Never requested"
              className="rounded-2xl border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] p-5 shadow-card"
            >
              <h2 className="font-display text-lg font-semibold text-[var(--color-amber-700)]">
                Never Requested
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                These rewards have never been redeemed
              </p>
              <ul className="mt-3 space-y-2">
                {demand.neverRequested.map((reward) => (
                  <li key={reward.rewardId}>
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {reward.rewardName}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Card as="section" aria-label="Reward rankings">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
              Most Requested Rewards
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              All time, sorted by request count
            </p>

            {demand.rankings.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                No reward requests yet
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {demand.rankings.map((ranking) => (
                  <div
                    key={ranking.rewardId}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">
                      {ranking.rewardName}
                    </p>
                    <div className="flex items-center gap-4 text-xs tabular-nums">
                      <span className="font-semibold text-[var(--color-text-secondary)]">
                        {ranking.requestCount} request{ranking.requestCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {ranking.approvedCount} approved
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {ranking.totalCost} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
