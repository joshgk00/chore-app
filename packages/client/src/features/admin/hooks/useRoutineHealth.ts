import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import type { RoutineHealthAnalytics } from "@chore-app/shared";

export function useRoutineHealth(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.routineAnalytics(),
    queryFn: async () => {
      const result = await api.get<RoutineHealthAnalytics>(
        "/api/admin/routine-analytics",
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isOnline,
    staleTime: 5 * 60_000,
  });
}
