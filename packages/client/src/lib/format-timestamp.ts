/**
 * Formats a YYYY-MM-DD calendar date (local_date) without UTC normalization.
 *
 * Calendar dates represent a day in the user's timezone, not a UTC point in
 * time. Unlike formatTimestamp, this constructs a local-time Date from the
 * numeric components so the displayed day is never shifted by timezone offset.
 */
export function formatCalendarDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, options);
}

/**
 * Parses a SQLite UTC timestamp and formats it in the given timezone.
 *
 * SQLite's datetime('now') produces "YYYY-MM-DD HH:MM:SS" with no timezone
 * indicator. Browsers vary in whether they treat bare ISO strings as UTC or
 * local time, so we normalise to an explicit UTC value before formatting.
 */
export function formatTimestamp(
  dateStr: string,
  options: Intl.DateTimeFormatOptions,
  timezone?: string,
): string {
  // Ensure ISO-8601 separator (Safari rejects space-separated strings).
  let normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");

  // Append "Z" if there is no timezone indicator, so the value is always
  // parsed as UTC rather than local time.
  if (!normalized.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized += "Z";
  }

  const resolvedOptions: Intl.DateTimeFormatOptions = timezone
    ? { ...options, timeZone: timezone }
    : options;

  const date = new Date(normalized);

  try {
    return date.toLocaleString(undefined, resolvedOptions);
  } catch (error) {
    // Guard against invalid IANA time zone names causing a RangeError.
    if (error instanceof RangeError && timezone) {
      const fallbackOptions: Intl.DateTimeFormatOptions = { ...options };
      return date.toLocaleString(undefined, fallbackOptions);
    }
    throw error;
  }
}
