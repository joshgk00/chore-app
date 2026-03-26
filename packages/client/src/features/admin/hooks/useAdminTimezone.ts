import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";

interface SettingsResponse {
  [key: string]: string;
}

/**
 * Returns the configured IANA timezone from admin settings, falling back to
 * the browser's local timezone when the setting is absent or the query hasn't
 * resolved yet.
 */
export function useAdminTimezone(): string {
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const result = await api.get<SettingsResponse>("/api/admin/settings");
      if (!result.ok) throw result.error;
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    query.data?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}
