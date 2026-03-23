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

// Time slot enum
export type TimeSlot = "morning" | "afternoon" | "bedtime" | "anytime";

// Completion rule enum
export type CompletionRule = "once_per_day" | "once_per_slot" | "unlimited";

// Asset source
export type AssetSource = "upload" | "ai_generated";

// Asset status
export type AssetStatus = "processing" | "ready" | "failed";

// Push subscription role
export type PushRole = "child" | "admin";

// Push subscription status
export type PushStatus = "active" | "expired" | "failed";
