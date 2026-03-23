import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import type { ActivityEvent } from "@chore-app/shared";

export function useActivity(limit = 20) {
  return useQuery({
    queryKey: ["activity", limit],
    queryFn: async () => {
      const result = await api.get<ActivityEvent[]>(
        `/api/activity/recent?limit=${limit}`,
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
