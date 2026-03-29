import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { queryKeys } from "../../../lib/query-keys.js";
import { useOnline } from "../../../contexts/OnlineContext.js";

interface SettingsResponse {
  [key: string]: string;
}

export function useAdminSettings() {
  const isOnline = useOnline();

  return useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: async () => {
      const result = await api.get<SettingsResponse>("/api/admin/settings");
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: isOnline,
    staleTime: 5 * 60_000,
  });
}
