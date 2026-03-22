// API response envelope
export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Status enum for approvals
export type Status = "pending" | "approved" | "rejected" | "canceled";

// Entry types for points ledger
export type EntryType = "routine" | "chore" | "reward" | "manual";

// Time slot enum (matches DB constraint values)
export type TimeSlot = "morning" | "afternoon" | "bedtime" | "anytime";

// Completion rule enum
export type CompletionRule = "once_per_day" | "once_per_slot" | "unlimited";

// Alias used in routine/chore domain logic
export type FrequencyType = CompletionRule;

// Slot configuration (start/end times in HH:MM format)
export interface SlotConfig {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  bedtimeStart: string;
  bedtimeEnd: string;
}

// Activity event shape
export interface ActivityEvent {
  eventType: string;
  entityType?: string;
  entityId?: number;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

// Bootstrap data (initial shape — extended by each subsequent PR)
export interface BootstrapData {
  [key: string]: unknown;
}

// Asset source
export type AssetSource = "upload" | "ai_generated";

// Asset status
export type AssetStatus = "processing" | "ready" | "failed";

// Push subscription role
export type PushRole = "child" | "admin";

// Push subscription status
export type PushStatus = "active" | "expired" | "failed";
