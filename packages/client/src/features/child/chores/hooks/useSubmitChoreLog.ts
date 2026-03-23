import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import type { ChoreLog } from "@chore-app/shared";

interface SubmitChoreLogPayload {
  choreId: number;
  tierId: number;
  idempotencyKey: string;
  localDate: string;
}

export function useSubmitChoreLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitChoreLogPayload) => {
      const result = await api.post<ChoreLog>("/api/chore-logs", payload);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}
