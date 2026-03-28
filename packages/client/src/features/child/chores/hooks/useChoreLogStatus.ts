import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { queryKeys } from "../../../../lib/query-keys.js";
import type { ChoreLog } from "@chore-app/shared";
import { useOnline } from "../../../../contexts/OnlineContext.js";

const POLL_INTERVAL_MS = 10_000;

export function useChoreLogStatus(logId: number | null) {
  const isOnline = useOnline();
  const isEnabled = logId !== null && isOnline;

  return useQuery({
    queryKey: queryKeys.choreLog(logId),
    queryFn: async () => {
      const result = await api.get<ChoreLog>(`/api/chore-logs/${logId}`);
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isEnabled,
    refetchInterval: isEnabled ? POLL_INTERVAL_MS : false,
    staleTime: 0,
  });
}
