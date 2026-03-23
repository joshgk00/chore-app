import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import type { Badge } from "@chore-app/shared";

export function useBadges() {
  return useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const result = await api.get<Badge[]>("/api/badges");
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
