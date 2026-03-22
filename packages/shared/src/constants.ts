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

// Rate limiting
export const MAX_PIN_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MINUTES = 15;
export const COOLDOWN_ESCALATION_MINUTES = [15, 30, 60] as const;
