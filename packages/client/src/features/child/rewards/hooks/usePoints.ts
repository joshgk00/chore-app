import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { queryKeys } from "../../../../lib/query-keys.js";
import type { PointsBalance } from "@chore-app/shared";

export function usePoints() {
  return useQuery({
    queryKey: queryKeys.points(),
    queryFn: async () => {
      const result = await api.get<PointsBalance>("/api/points/summary");
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
