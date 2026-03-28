import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { queryKeys } from "../../../../lib/query-keys.js";
import type { Routine } from "@chore-app/shared";

export function useRoutine(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.routine(id),
    queryFn: async () => {
      const result = await api.get<Routine>(`/api/routines/${id}`);
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: id !== undefined,
  });
}
