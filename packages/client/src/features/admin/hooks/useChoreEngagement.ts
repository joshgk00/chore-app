import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import type { ChoreEngagementAnalytics } from "@chore-app/shared";

export function useChoreEngagement(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.choreAnalytics(),
    queryFn: async () => {
      const result = await api.get<ChoreEngagementAnalytics>(
        "/api/admin/chore-analytics",
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isOnline,
    staleTime: 5 * 60_000,
  });
}
