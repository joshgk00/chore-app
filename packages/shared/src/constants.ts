// Default time slot windows (24h format)
export const DEFAULT_TIME_SLOTS = {
  morning_start: "05:00",
  morning_end: "10:59",
  afternoon_start: "15:00",
  afternoon_end: "18:29",
  bedtime_start: "18:30",
  bedtime_end: "21:30",
} as const;

// Badge key constants
export const BADGE_KEYS = {
  FIRST_STEP: "first_step",
  ON_A_ROLL: "on_a_roll",
  WEEK_WARRIOR: "week_warrior",
  CHORE_CHAMPION: "chore_champion",
  BIG_SPENDER: "big_spender",
  POINT_HOARDER: "point_hoarder",
  HELPING_HAND: "helping_hand",
  SOLO_ACT: "solo_act",
} as const;

// PIN constraints
export const PIN_MIN_LENGTH = 6;

// Session settings
export const SESSION_DURATION_MINUTES = 10;
export const SESSION_COOKIE_NAME = "chores_session";

// Rate limiting (auth)
export const MAX_PIN_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MINUTES = 15;
export const COOLDOWN_ESCALATION_MINUTES = [15, 30, 60] as const;

// EntryType in types.ts is derived from this array — add new types here
export const ENTRY_TYPES = ["routine", "chore", "reward", "manual"] as const;

// Activity event types used for logging and filtering
export const ACTIVITY_EVENT_TYPES = [
  "routine_submitted",
  "routine_approved",
  "routine_rejected",
  "chore_submitted",
  "chore_approved",
  "chore_rejected",
  "chore_canceled",
  "reward_requested",
  "reward_approved",
  "reward_rejected",
  "reward_canceled",
  "manual_adjustment",
  "asset_uploaded",
  "asset_generated",
  "asset_archived",
] as const;

// Rate limiting (submission endpoints: POST /routine-completions, /chore-logs, /reward-requests)
export const SUBMISSION_RATE_LIMIT_MAX = 10;
export const SUBMISSION_RATE_LIMIT_WINDOW_SECONDS = 10;

// Push subscription caps
export const MAX_PUSH_SUBSCRIPTIONS_PER_IP = 10;

// Push subscription cleanup
export const PUSH_CLEANUP_INTERVAL_HOURS = 24;
export const PUSH_FAILED_TTL_DAYS = 30;
export const PUSH_INACTIVE_TTL_DAYS = 90;
