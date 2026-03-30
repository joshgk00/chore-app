import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import type { PendingApprovals } from "@chore-app/shared";

interface UseApprovalsOptions {
  isOnline: boolean;
  autoRefreshMs?: number | false;
}

export function useApprovals({ isOnline, autoRefreshMs = false }: UseApprovalsOptions) {
  return useQuery({
    queryKey: queryKeys.admin.approvals(),
    queryFn: async () => {
      const result = await api.get<PendingApprovals>("/api/admin/approvals");
      if (!result.ok) throw result.error;
      return result.data;
    },
    refetchInterval: autoRefreshMs && isOnline ? autoRefreshMs : false,
    enabled: isOnline,
  });
}
