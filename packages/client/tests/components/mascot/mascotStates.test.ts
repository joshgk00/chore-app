import { describe, it, expect, vi, afterEach } from "vitest";
import { determineMascotState, isRecentApproval, type MascotContext } from "../../../src/components/mascot/mascotStates.js";
import { DEFAULT_TIME_SLOTS, RECENT_APPROVAL_WINDOW_MS } from "@chore-app/shared";

const slotConfig = {
  morningStart: DEFAULT_TIME_SLOTS.morning_start,
  morningEnd: DEFAULT_TIME_SLOTS.morning_end,
  afternoonStart: DEFAULT_TIME_SLOTS.afternoon_start,
  afternoonEnd: DEFAULT_TIME_SLOTS.afternoon_end,
  bedtimeStart: DEFAULT_TIME_SLOTS.bedtime_start,
  bedtimeEnd: DEFAULT_TIME_SLOTS.bedtime_end,
};

function makeTime(hours: number, minutes = 0): Date {
  const date = new Date(2026, 2, 25);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

describe("determineMascotState", () => {
  it("returns greeting during morning hours with no special context", () => {
    const context: MascotContext = { now: makeTime(8), slotConfig };
    expect(determineMascotState(context)).toBe("greeting");
  });

  it("returns greeting during afternoon hours with no special context", () => {
    const context: MascotContext = { now: makeTime(16), slotConfig };
    expect(determineMascotState(context)).toBe("greeting");
  });

  it("returns happy when there is a recent approval", () => {
    const context: MascotContext = {
      now: makeTime(10),
      slotConfig,
      hasRecentApproval: true,
    };
    expect(determineMascotState(context)).toBe("happy");
  });

  it("returns celebrating when a badge was just unlocked", () => {
    const context: MascotContext = {
      now: makeTime(10),
      slotConfig,
      hasBadgeOrRewardApproval: true,
    };
    expect(determineMascotState(context)).toBe("celebrating");
  });

  it("returns waiting when pending approvals exist", () => {
    const context: MascotContext = {
      now: makeTime(10),
      slotConfig,
      hasPendingApprovals: true,
    };
    expect(determineMascotState(context)).toBe("waiting");
  });

  it("returns encouraging when there is an active draft", () => {
    const context: MascotContext = {
      now: makeTime(10),
      slotConfig,
      hasActiveDraft: true,
    };
    expect(determineMascotState(context)).toBe("encouraging");
  });

  it("returns sleeping after bedtime slot ends", () => {
    const context: MascotContext = { now: makeTime(23), slotConfig };
    expect(determineMascotState(context)).toBe("sleeping");
  });

  it("returns sleeping before morning starts", () => {
    const context: MascotContext = { now: makeTime(3), slotConfig };
    expect(determineMascotState(context)).toBe("sleeping");
  });

  describe("state priority", () => {
    it("celebrating beats happy", () => {
      const context: MascotContext = {
        now: makeTime(10),
        slotConfig,
        hasBadgeOrRewardApproval: true,
        hasRecentApproval: true,
      };
      expect(determineMascotState(context)).toBe("celebrating");
    });

    it("happy beats encouraging", () => {
      const context: MascotContext = {
        now: makeTime(10),
        slotConfig,
        hasRecentApproval: true,
        hasActiveDraft: true,
      };
      expect(determineMascotState(context)).toBe("happy");
    });

    it("encouraging beats waiting", () => {
      const context: MascotContext = {
        now: makeTime(10),
        slotConfig,
        hasActiveDraft: true,
        hasPendingApprovals: true,
      };
      expect(determineMascotState(context)).toBe("encouraging");
    });

    it("waiting beats greeting", () => {
      const context: MascotContext = {
        now: makeTime(10),
        slotConfig,
        hasPendingApprovals: true,
      };
      expect(determineMascotState(context)).toBe("waiting");
    });

    it("celebrating beats sleeping", () => {
      const context: MascotContext = {
        now: makeTime(23),
        slotConfig,
        hasBadgeOrRewardApproval: true,
      };
      expect(determineMascotState(context)).toBe("celebrating");
    });

    it("greeting beats sleeping during active hours", () => {
      const context: MascotContext = { now: makeTime(12), slotConfig };
      expect(determineMascotState(context)).toBe("greeting");
    });
  });

  it("uses default slot config when none provided", () => {
    const context: MascotContext = { now: makeTime(8) };
    expect(determineMascotState(context)).toBe("greeting");
  });

  describe("time boundaries", () => {
    it("returns greeting at exactly bedtimeEnd (21:30)", () => {
      const context: MascotContext = { now: makeTime(21, 30), slotConfig };
      expect(determineMascotState(context)).toBe("greeting");
    });

    it("returns sleeping one minute after bedtimeEnd (21:31)", () => {
      const context: MascotContext = { now: makeTime(21, 31), slotConfig };
      expect(determineMascotState(context)).toBe("sleeping");
    });

    it("returns sleeping one minute before morningStart (04:59)", () => {
      const context: MascotContext = { now: makeTime(4, 59), slotConfig };
      expect(determineMascotState(context)).toBe("sleeping");
    });

    it("returns greeting at exactly morningStart (05:00)", () => {
      const context: MascotContext = { now: makeTime(5, 0), slotConfig };
      expect(determineMascotState(context)).toBe("greeting");
    });
  });

  describe("invalid slot config", () => {
    it("falls back to greeting when slot times are malformed", () => {
      const badConfig = {
        ...slotConfig,
        bedtimeEnd: "invalid",
        morningStart: "nope",
      };
      const context: MascotContext = { now: makeTime(23), slotConfig: badConfig };
      expect(determineMascotState(context)).toBe("greeting");
    });

    it("falls back to greeting when slot times have out-of-range values", () => {
      const badConfig = {
        ...slotConfig,
        bedtimeEnd: "25:00",
        morningStart: "05:60",
      };
      const context: MascotContext = { now: makeTime(23), slotConfig: badConfig };
      expect(determineMascotState(context)).toBe("greeting");
    });
  });
});

describe("isRecentApproval", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when lastApprovalAt is undefined", () => {
    expect(isRecentApproval(undefined)).toBe(false);
  });

  it("returns false when lastApprovalAt is empty string", () => {
    expect(isRecentApproval("")).toBe(false);
  });

  it("returns true when approval is within the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:05:00Z"));

    expect(isRecentApproval("2026-03-25T12:00:00Z")).toBe(true);
  });

  it("returns false when approval is older than the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:15:00Z"));

    expect(isRecentApproval("2026-03-25T12:00:00Z")).toBe(false);
  });

  it("normalizes SQLite space-separated timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:05:00Z"));

    expect(isRecentApproval("2026-03-25 12:00:00")).toBe(true);
  });

  it("returns false for unparseable timestamps", () => {
    expect(isRecentApproval("not-a-date")).toBe(false);
  });

  it("returns false when approval timestamp is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00Z"));

    expect(isRecentApproval("2026-03-25T12:05:00Z")).toBe(false);
  });

  it("returns false when approval is exactly at the window boundary", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-25T12:10:00Z");
    vi.setSystemTime(now);

    const approvalAt = new Date(now.getTime() - RECENT_APPROVAL_WINDOW_MS).toISOString();
    expect(isRecentApproval(approvalAt)).toBe(false);
  });
});
