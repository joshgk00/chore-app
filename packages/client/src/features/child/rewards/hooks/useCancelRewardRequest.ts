import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { invalidateBootstrapAndPoints } from "../../../../lib/query-keys.js";
import type { RewardRequest } from "@chore-app/shared";

export function useCancelRewardRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: number) => {
      const result = await api.post<RewardRequest>(
        `/api/reward-requests/${requestId}/cancel`,
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      invalidateBootstrapAndPoints(queryClient);
    },
  });
}
