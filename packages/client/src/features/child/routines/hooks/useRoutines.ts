import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import type { Routine } from "@chore-app/shared";

export function useRoutines() {
  return useQuery({
    queryKey: ["routines"],
    queryFn: async () => {
      const result = await api.get<Routine[]>("/api/routines");
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
