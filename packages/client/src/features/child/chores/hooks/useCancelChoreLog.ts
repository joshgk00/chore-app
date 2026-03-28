import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { queryKeys } from "../../../../lib/query-keys.js";
import type { ChoreLog } from "@chore-app/shared";

export function useCancelChoreLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: number) => {
      const result = await api.post<ChoreLog>(`/api/chore-logs/${logId}/cancel`);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores() });
      queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap() });
    },
  });
}
