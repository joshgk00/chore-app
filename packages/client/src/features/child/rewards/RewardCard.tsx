import { useState } from "react";
import { useOnline } from "../../../contexts/OnlineContext.js";
import { generateIdempotencyKey } from "../../../lib/idempotency.js";
import { formatLocalDate } from "../../../lib/draft-sync.js";
import { useSubmitRewardRequest } from "./hooks/useSubmitRewardRequest.js";
import { useCancelRewardRequest } from "./hooks/useCancelRewardRequest.js";
import type { Reward, RewardRequest } from "@chore-app/shared";

interface RewardCardProps {
  reward: Reward;
  availablePoints: number;
  pendingRequest?: RewardRequest;
}

export default function RewardCard({ reward, availablePoints, pendingRequest }: RewardCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isOnline = useOnline();
  const submitMutation = useSubmitRewardRequest();
  const cancelMutation = useCancelRewardRequest();

  const isAffordable = availablePoints >= reward.pointsCost;
  const progressPercent = reward.pointsCost === 0
    ? 100
    : Math.min((availablePoints / reward.pointsCost) * 100, 100);

  function handleRequest() {
    submitMutation.mutate(
      {
        rewardId: reward.id,
        idempotencyKey: generateIdempotencyKey(),
        localDate: formatLocalDate(),
      },
      {
        onSuccess: () => setIsConfirming(false),
        onError: () => setIsConfirming(false),
      },
    );
  }

  function handleCancel() {
    if (!pendingRequest) return;
    cancelMutation.mutate(pendingRequest.id);
  }

  if (pendingRequest) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{reward.name}</h3>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            Pending
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">{reward.pointsCost} pts</p>
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelMutation.isPending || !isOnline}
          className="mt-3 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {cancelMutation.isPending ? "Canceling..." : "Cancel Request"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <h3 className="font-bold text-gray-800">{reward.name}</h3>
      <p className="mt-1 text-sm text-gray-500">{reward.pointsCost} pts</p>

      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={Math.min(availablePoints, reward.pointsCost)}
            aria-valuemin={0}
            aria-valuemax={reward.pointsCost}
            aria-label={`${Math.min(availablePoints, reward.pointsCost)} of ${reward.pointsCost} points`}
          />
        </div>
      </div>

      {isConfirming ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-3" role="alertdialog" aria-label="Confirm reward request">
          <p className="text-sm font-medium text-gray-700">
            Redeem {reward.name} for {reward.pointsCost} points?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRequest}
              disabled={submitMutation.isPending}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {submitMutation.isPending ? "Requesting..." : "Confirm"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          disabled={!isAffordable || !isOnline || submitMutation.isPending}
          className="mt-3 w-full rounded-xl bg-amber-500 py-2.5 font-bold text-white transition-all duration-200 hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {isAffordable ? "Request" : `Need ${reward.pointsCost - availablePoints} more pts`}
        </button>
      )}

      {submitMutation.isError && (
        <p className="mt-2 text-center text-sm text-red-600" aria-live="assertive">
          Could not request this reward. Please try again.
        </p>
      )}
    </div>
  );
}
