import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { queryKeys } from "../../../../lib/query-keys.js";
import type { Reward } from "@chore-app/shared";

export function useRewards() {
  return useQuery({
    queryKey: queryKeys.rewards(),
    queryFn: async () => {
      const result = await api.get<Reward[]>("/api/rewards");
      if (!result.ok) throw result.error;
      return result.data;
    },
    staleTime: 5 * 60_000,
  });
}
