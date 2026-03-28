import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import { queryKeys } from "../../../../lib/query-keys.js";
import type { BootstrapData } from "@chore-app/shared";

export function useBootstrap() {
  return useQuery({
    queryKey: queryKeys.bootstrap(),
    queryFn: async () => {
      const result = await api.get<BootstrapData>("/api/app/bootstrap");
      if (!result.ok) throw result.error;
      return result.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
