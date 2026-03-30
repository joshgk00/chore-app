import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import type { RewardDemandAnalytics } from "@chore-app/shared";

export function useRewardDemand(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.rewardAnalytics(),
    queryFn: async () => {
      const result = await api.get<RewardDemandAnalytics>(
        "/api/admin/reward-analytics",
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isOnline,
    staleTime: 5 * 60_000,
  });
}
