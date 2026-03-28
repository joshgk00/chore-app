import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { queryKeys } from "../../../../lib/query-keys.js";
import type { Chore } from "@chore-app/shared";

export function useChores() {
  return useQuery({
    queryKey: queryKeys.chores(),
    queryFn: async () => {
      const result = await api.get<Chore[]>("/api/chores");
      if (!result.ok) throw result.error;
      return result.data;
    },
    staleTime: 5 * 60_000,
  });
}
