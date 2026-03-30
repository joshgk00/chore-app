import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import type { SystemHealthStats } from "@chore-app/shared";

export function useSystemHealth(isOnline: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.systemHealth(),
    queryFn: async () => {
      const result = await api.get<SystemHealthStats>(
        "/api/admin/system-health",
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isOnline,
    staleTime: 5 * 60_000,
  });
}
