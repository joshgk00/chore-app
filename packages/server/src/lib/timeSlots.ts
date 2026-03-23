import type { TimeSlot, CompletionRule, SlotConfig } from "@chore-app/shared";
import { DEFAULT_TIME_SLOTS } from "@chore-app/shared";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeInTimezone(date: Date, timezone: string): { hours: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    let formatter = formatterCache.get(timezone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hourCycle: "h23",
      });
      formatterCache.set(timezone, formatter);
    }
    parts = formatter.formatToParts(date);
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const hourPart = parts.find(p => p.type === "hour");
  const minutePart = parts.find(p => p.type === "minute");
  if (!hourPart || !minutePart) {
    throw new Error(`Unexpected DateTimeFormat output for timezone ${timezone}`);
  }

  return {
    hours: parseInt(hourPart.value, 10),
    minutes: parseInt(minutePart.value, 10),
  };
}

function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid time format: ${time}`);
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) throw new Error(`Time out of range: ${time}`);
  return h * 60 + m;
}

export function getCurrentSlot(now: Date, timezone: string, slotConfig: SlotConfig): TimeSlot | null {
  const { hours, minutes } = getTimeInTimezone(now, timezone);
  const currentMinutes = hours * 60 + minutes;

  const slots: Array<{ name: TimeSlot; start: string; end: string }> = [
    { name: "morning", start: slotConfig.morningStart, end: slotConfig.morningEnd },
    { name: "afternoon", start: slotConfig.afternoonStart, end: slotConfig.afternoonEnd },
    { name: "bedtime", start: slotConfig.bedtimeStart, end: slotConfig.bedtimeEnd },
  ];

  for (const slot of slots) {
    const startMin = parseTimeToMinutes(slot.start);
    const endMin = parseTimeToMinutes(slot.end);
    if (currentMinutes >= startMin && currentMinutes <= endMin) {
      return slot.name;
    }
  }

  return null;
}

export function isRoutineVisible(
  routineTimeSlot: TimeSlot,
  now: Date,
  timezone: string,
  slotConfig: SlotConfig,
): boolean {
  if (routineTimeSlot === "anytime") return true;
  return getCurrentSlot(now, timezone, slotConfig) === routineTimeSlot;
}

export function getCompletionWindowKey(
  routineId: number,
  completionRule: CompletionRule,
  localDate: string,
  timeSlot: TimeSlot,
): string | null {
  switch (completionRule) {
    case "once_per_day":
      return `routine:${routineId}:day:${localDate}`;
    case "once_per_slot":
      return `routine:${routineId}:slot:${localDate}:${timeSlot}`;
    case "unlimited":
      return null;
  }
}

export interface SlotContext {
  timezone: string;
  slotConfig: SlotConfig;
  currentSlot: TimeSlot;
}

export function resolveSlotContext(allSettings: Record<string, string>): SlotContext {
  const timezone = allSettings["timezone"] ?? "America/New_York";
  const slotConfig = getSlotConfigFromSettings(allSettings);
  const currentSlot: TimeSlot = getCurrentSlot(new Date(), timezone, slotConfig) ?? "anytime";
  return { timezone, slotConfig, currentSlot };
}

export function getSlotConfigFromSettings(settings: Record<string, string>): SlotConfig {
  return {
    morningStart: settings["morning_start"] ?? DEFAULT_TIME_SLOTS.morning_start,
    morningEnd: settings["morning_end"] ?? DEFAULT_TIME_SLOTS.morning_end,
    afternoonStart: settings["afternoon_start"] ?? DEFAULT_TIME_SLOTS.afternoon_start,
    afternoonEnd: settings["afternoon_end"] ?? DEFAULT_TIME_SLOTS.afternoon_end,
    bedtimeStart: settings["bedtime_start"] ?? DEFAULT_TIME_SLOTS.bedtime_start,
    bedtimeEnd: settings["bedtime_end"] ?? DEFAULT_TIME_SLOTS.bedtime_end,
  };
}
