import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { invalidateBootstrapAndPoints } from "../../../../lib/query-keys.js";
import type { RewardRequest } from "@chore-app/shared";

interface SubmitRewardRequestPayload {
  rewardId: number;
  idempotencyKey: string;
  localDate: string;
}

export function useSubmitRewardRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitRewardRequestPayload) => {
      const result = await api.post<RewardRequest>(
        "/api/reward-requests",
        payload,
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      invalidateBootstrapAndPoints(queryClient);
    },
  });
}
