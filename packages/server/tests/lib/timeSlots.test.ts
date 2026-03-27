import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SlotConfig } from '@chore-app/shared';
import { DEFAULT_TIME_SLOTS } from '@chore-app/shared';
import {
  getCurrentSlot,
  isRoutineVisible,
  getCompletionWindowKey,
  getSlotConfigFromSettings,
  resolveSlotContext,
} from '../../src/lib/timeSlots.js';

function dateAtTime(hours: number, minutes: number, timezone: string, dateStr = "2026-03-15"): Date {
  // Build a UTC anchor at noon on the target date (safe from DST edges)
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const noonParts = formatter.formatToParts(noonUtc);
  const noonLocalH = parseInt(noonParts.find(p => p.type === "hour")!.value, 10);
  const noonLocalM = parseInt(noonParts.find(p => p.type === "minute")!.value, 10);
  const noonLocalMinutes = noonLocalH * 60 + noonLocalM;
  const targetMinutes = hours * 60 + minutes;
  const diffMs = (targetMinutes - noonLocalMinutes) * 60 * 1000;
  return new Date(noonUtc.getTime() + diffMs);
}

const defaultConfig: SlotConfig = {
  morningStart: DEFAULT_TIME_SLOTS.morning_start,
  morningEnd: DEFAULT_TIME_SLOTS.morning_end,
  afternoonStart: DEFAULT_TIME_SLOTS.afternoon_start,
  afternoonEnd: DEFAULT_TIME_SLOTS.afternoon_end,
  bedtimeStart: DEFAULT_TIME_SLOTS.bedtime_start,
  bedtimeEnd: DEFAULT_TIME_SLOTS.bedtime_end,
};
const TZ = "America/New_York";

afterEach(() => {
  vi.useRealTimers();
});

describe('timeSlots', () => {
  describe('getCurrentSlot', () => {
    it('returns morning at 7:00 AM', () => {
      expect(getCurrentSlot(dateAtTime(7, 0, TZ), TZ, defaultConfig)).toBe('morning');
    });

    it('returns afternoon at 4:00 PM', () => {
      expect(getCurrentSlot(dateAtTime(16, 0, TZ), TZ, defaultConfig)).toBe('afternoon');
    });

    it('returns bedtime at 8:00 PM', () => {
      expect(getCurrentSlot(dateAtTime(20, 0, TZ), TZ, defaultConfig)).toBe('bedtime');
    });

    it('returns null during gap period (12:00 PM)', () => {
      expect(getCurrentSlot(dateAtTime(12, 0, TZ), TZ, defaultConfig)).toBeNull();
    });

    it('slot boundaries are inclusive', () => {
      expect(getCurrentSlot(dateAtTime(5, 0, TZ), TZ, defaultConfig)).toBe('morning');
      expect(getCurrentSlot(dateAtTime(10, 59, TZ), TZ, defaultConfig)).toBe('morning');
    });

    it('custom slot windows from settings override defaults', () => {
      const customConfig: SlotConfig = {
        ...defaultConfig,
        morningStart: "06:00",
        morningEnd: "09:00",
      };
      expect(getCurrentSlot(dateAtTime(5, 0, TZ), TZ, customConfig)).toBeNull();
      expect(getCurrentSlot(dateAtTime(6, 0, TZ), TZ, customConfig)).toBe('morning');
    });

    it('timezone affects slot matching', () => {
      const utcDate = new Date("2026-03-15T12:00:00Z");
      const eastern = getCurrentSlot(utcDate, "America/New_York", defaultConfig);
      const pacific = getCurrentSlot(utcDate, "America/Los_Angeles", defaultConfig);
      expect(eastern).toBe('morning');
      expect(pacific).toBe('morning');

      const utcEvening = new Date("2026-03-15T23:00:00Z");
      expect(getCurrentSlot(utcEvening, "America/New_York", defaultConfig)).toBe('bedtime');
      expect(getCurrentSlot(utcEvening, "America/Los_Angeles", defaultConfig)).toBe('afternoon');
    });

    it('handles DST spring-forward correctly', () => {
      // 2026-03-08 is spring-forward day for America/New_York
      // 7:00 AM EDT should still be morning
      const springForward = dateAtTime(7, 0, TZ, "2026-03-08");
      expect(getCurrentSlot(springForward, TZ, defaultConfig)).toBe('morning');
      // 8:00 PM EDT should still be bedtime
      const springBedtime = dateAtTime(20, 0, TZ, "2026-03-08");
      expect(getCurrentSlot(springBedtime, TZ, defaultConfig)).toBe('bedtime');
    });

    it('returns null at midnight', () => {
      expect(getCurrentSlot(dateAtTime(0, 0, TZ), TZ, defaultConfig)).toBeNull();
    });

    it('throws for invalid timezone', () => {
      expect(() => getCurrentSlot(new Date(), "Atlantis/Lost_City", defaultConfig))
        .toThrow("Invalid timezone");
    });
  });

  describe('isRoutineVisible', () => {
    it('anytime routine is always visible regardless of time', () => {
      expect(isRoutineVisible('anytime', dateAtTime(12, 0, TZ), TZ, defaultConfig)).toBe(true);
      expect(isRoutineVisible('anytime', dateAtTime(7, 0, TZ), TZ, defaultConfig)).toBe(true);
      expect(isRoutineVisible('anytime', dateAtTime(3, 0, TZ), TZ, defaultConfig)).toBe(true);
    });

    it('returns false when routine slot does not match current time', () => {
      expect(isRoutineVisible('morning', dateAtTime(16, 0, TZ), TZ, defaultConfig)).toBe(false);
      expect(isRoutineVisible('bedtime', dateAtTime(7, 0, TZ), TZ, defaultConfig)).toBe(false);
    });

    it('returns true when routine slot matches current time', () => {
      expect(isRoutineVisible('morning', dateAtTime(7, 0, TZ), TZ, defaultConfig)).toBe(true);
      expect(isRoutineVisible('afternoon', dateAtTime(16, 0, TZ), TZ, defaultConfig)).toBe(true);
    });

    it('server uses household timezone, not device timezone', () => {
      // Same absolute time, but different results per timezone
      const utcTime = new Date("2026-03-15T23:00:00Z");
      // UTC 23:00 = 19:00 ET (bedtime) -- household TZ
      expect(isRoutineVisible('bedtime', utcTime, "America/New_York", defaultConfig)).toBe(true);
      // If device were in UTC, 23:00 would be outside all slots
      expect(isRoutineVisible('bedtime', utcTime, "UTC", defaultConfig)).toBe(false);
    });
  });

  describe('getCompletionWindowKey', () => {
    it('returns correct keys for all completion rules', () => {
      expect(getCompletionWindowKey(5, 'once_per_day', '2026-03-15', 'morning'))
        .toBe('routine:5:day:2026-03-15');

      expect(getCompletionWindowKey(5, 'once_per_slot', '2026-03-15', 'morning'))
        .toBe('routine:5:slot:2026-03-15:morning');

      expect(getCompletionWindowKey(5, 'unlimited', '2026-03-15', 'morning'))
        .toBeNull();
    });

    it('day boundary: different local dates produce different keys', () => {
      const keyToday = getCompletionWindowKey(5, 'once_per_day', '2026-03-15', 'bedtime');
      const keyTomorrow = getCompletionWindowKey(5, 'once_per_day', '2026-03-16', 'morning');
      expect(keyToday).not.toBe(keyTomorrow);
    });
  });

  describe('getSlotConfigFromSettings', () => {
    it('falls back to defaults for missing keys', () => {
      const partial = { morning_start: "06:30" };
      const config = getSlotConfigFromSettings(partial);
      expect(config.morningStart).toBe("06:30");
      expect(config.morningEnd).toBe(DEFAULT_TIME_SLOTS.morning_end);
      expect(config.afternoonStart).toBe(DEFAULT_TIME_SLOTS.afternoon_start);
      expect(config.afternoonEnd).toBe(DEFAULT_TIME_SLOTS.afternoon_end);
      expect(config.bedtimeStart).toBe(DEFAULT_TIME_SLOTS.bedtime_start);
      expect(config.bedtimeEnd).toBe(DEFAULT_TIME_SLOTS.bedtime_end);
    });

    it('uses all provided settings', () => {
      const full = {
        morning_start: "06:00",
        morning_end: "09:30",
        afternoon_start: "14:00",
        afternoon_end: "17:00",
        bedtime_start: "19:00",
        bedtime_end: "22:00",
      };
      const config = getSlotConfigFromSettings(full);
      expect(config.morningStart).toBe("06:00");
      expect(config.morningEnd).toBe("09:30");
      expect(config.afternoonStart).toBe("14:00");
      expect(config.afternoonEnd).toBe("17:00");
      expect(config.bedtimeStart).toBe("19:00");
      expect(config.bedtimeEnd).toBe("22:00");
    });
  });

  describe('resolveSlotContext', () => {
    it('uses timezone from allSettings', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-15T11:00:00Z'));

      const ctx = resolveSlotContext({ timezone: 'America/New_York' });

      expect(ctx.timezone).toBe('America/New_York');
      expect(ctx.currentSlot).toBe('morning');
    });

    it('falls back to America/New_York when timezone is missing', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-15T11:00:00Z'));

      const ctx = resolveSlotContext({});

      expect(ctx.timezone).toBe('America/New_York');
      expect(ctx.currentSlot).toBe('morning');
    });

    it('uses custom slot config from settings', () => {
      vi.useFakeTimers();
      // 10:00 AM ET = 14:00 UTC (EDT offset is -4)
      vi.setSystemTime(new Date('2026-03-15T14:00:00Z'));

      const ctx = resolveSlotContext({
        timezone: 'America/New_York',
        morning_start: '09:00',
        morning_end: '10:30',
      });

      expect(ctx.currentSlot).toBe('morning');
      expect(ctx.slotConfig.morningStart).toBe('09:00');
      expect(ctx.slotConfig.morningEnd).toBe('10:30');
    });

    it('returns anytime when no slot matches current time', () => {
      vi.useFakeTimers();
      // 1:00 PM ET = 17:00 UTC — falls in the gap between morning and afternoon
      vi.setSystemTime(new Date('2026-03-15T17:00:00Z'));

      const ctx = resolveSlotContext({ timezone: 'America/New_York' });

      expect(ctx.currentSlot).toBe('anytime');
    });
  });

  describe('parseTimeToMinutes (via getCurrentSlot)', () => {
    it('throws for malformed time strings in slot config', () => {
      const badConfig: SlotConfig = {
        ...defaultConfig,
        morningStart: 'not-a-time',
      };
      expect(() => getCurrentSlot(dateAtTime(7, 0, TZ), TZ, badConfig)).toThrow('Invalid time format');
    });

    it('throws for out-of-range hour values', () => {
      const badConfig: SlotConfig = {
        ...defaultConfig,
        morningStart: '25:00',
      };
      expect(() => getCurrentSlot(dateAtTime(7, 0, TZ), TZ, badConfig)).toThrow('Time out of range');
    });

    it('throws for out-of-range minute values', () => {
      const badConfig: SlotConfig = {
        ...defaultConfig,
        morningStart: '05:60',
      };
      expect(() => getCurrentSlot(dateAtTime(7, 0, TZ), TZ, badConfig)).toThrow('Time out of range');
    });
  });
});
