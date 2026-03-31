import { useAdminSettings } from "./useAdminSettings.js";

/**
 * Returns the configured IANA timezone from admin settings, falling back to
 * the browser's local timezone when the setting is absent or the query hasn't
 * resolved yet.
 */
export function useAdminTimezone(): string {
  const { data } = useAdminSettings();

  return (
    data?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}
