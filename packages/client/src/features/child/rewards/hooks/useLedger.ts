import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../api/client.js";
import type { LedgerEntry } from "@chore-app/shared";

export function useLedger(options: { limit?: number; offset?: number } = {}) {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;

  return useQuery({
    queryKey: ["ledger", limit, offset],
    queryFn: async () => {
      const result = await api.get<LedgerEntry[]>(
        `/api/points/ledger?limit=${limit}&offset=${offset}`,
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
