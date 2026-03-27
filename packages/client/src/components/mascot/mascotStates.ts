import type { SlotConfig } from "@chore-app/shared";
import { DEFAULT_TIME_SLOTS, RECENT_APPROVAL_WINDOW_MS } from "@chore-app/shared";

export type MascotState =
  | "greeting"
  | "happy"
  | "celebrating"
  | "waiting"
  | "encouraging"
  | "sleeping";

export interface MascotContext {
  now?: Date;
  slotConfig?: SlotConfig;
  hasRecentApproval?: boolean;
  hasBadgeOrRewardApproval?: boolean;
  hasPendingApprovals?: boolean;
  hasActiveDraft?: boolean;
}

function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return -1;
  return h * 60 + m;
}

function isBedtime(now: Date, slotConfig: SlotConfig): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const bedtimeEnd = parseTimeToMinutes(slotConfig.bedtimeEnd);
  const morningStart = parseTimeToMinutes(slotConfig.morningStart);
  if (bedtimeEnd < 0 || morningStart < 0) return false;
  return currentMinutes > bedtimeEnd || currentMinutes < morningStart;
}

function buildSlotConfig(partial?: SlotConfig): SlotConfig {
  if (partial) return partial;
  return {
    morningStart: DEFAULT_TIME_SLOTS.morning_start,
    morningEnd: DEFAULT_TIME_SLOTS.morning_end,
    afternoonStart: DEFAULT_TIME_SLOTS.afternoon_start,
    afternoonEnd: DEFAULT_TIME_SLOTS.afternoon_end,
    bedtimeStart: DEFAULT_TIME_SLOTS.bedtime_start,
    bedtimeEnd: DEFAULT_TIME_SLOTS.bedtime_end,
  };
}

/** SQLite datetime('now') omits 'T' and 'Z' — normalize for cross-browser Date parsing */
function normalizeSqliteTimestamp(ts: string): string {
  return ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
}

export function isRecentApproval(lastApprovalAt?: string): boolean {
  if (!lastApprovalAt) return false;
  const elapsed = Date.now() - new Date(normalizeSqliteTimestamp(lastApprovalAt)).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < RECENT_APPROVAL_WINDOW_MS;
}

export function determineMascotState(context: MascotContext): MascotState {
  if (context.hasBadgeOrRewardApproval) return "celebrating";
  if (context.hasRecentApproval) return "happy";
  if (context.hasActiveDraft) return "encouraging";
  if (context.hasPendingApprovals) return "waiting";

  const now = context.now ?? new Date();
  const slotConfig = buildSlotConfig(context.slotConfig);

  if (isBedtime(now, slotConfig)) return "sleeping";

  return "greeting";
}
