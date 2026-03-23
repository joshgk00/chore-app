import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import type { RoutineCompletion } from "@chore-app/shared";

interface SubmitRoutinePayload {
  routineId: number;
  checklistSnapshot: string;
  randomizedOrder: string | null;
  idempotencyKey: string;
  localDate: string;
}

export function useSubmitRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitRoutinePayload) => {
      const result = await api.post<RoutineCompletion>(
        "/api/routine-completions",
        payload,
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}
