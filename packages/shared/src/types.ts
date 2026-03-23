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

export interface SlotConfig {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  bedtimeStart: string;
  bedtimeEnd: string;
}

export interface ActivityEvent {
  eventType: string;
  entityType?: string;
  entityId?: number;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

// Asset source
export type AssetSource = "upload" | "ai_generated";

// Asset status
export type AssetStatus = "processing" | "ready" | "failed";

// Push subscription role
export type PushRole = "child" | "admin";

// Push subscription status
export type PushStatus = "active" | "expired" | "failed";

export interface ChecklistItem {
  id: number;
  routineId: number;
  label: string;
  imageAssetId?: number;
  sortOrder: number;
}

export interface Routine {
  id: number;
  name: string;
  timeSlot: TimeSlot;
  completionRule: CompletionRule;
  points: number;
  requiresApproval: boolean;
  imageAssetId?: number;
  randomizeItems: boolean;
  sortOrder: number;
  items: ChecklistItem[];
}

export interface RoutineCompletion {
  id: number;
  routineId: number;
  routineNameSnapshot: string;
  timeSlotSnapshot: string;
  completionRuleSnapshot: string;
  pointsSnapshot: number;
  requiresApprovalSnapshot: boolean;
  checklistSnapshotJson: string | null;
  randomizedOrderJson: string | null;
  completionWindowKey: string | null;
  completedAt: string;
  localDate: string;
  status: Status;
  idempotencyKey: string;
}

export interface BootstrapData {
  routines?: Routine[];
  pendingRoutineCount?: number;
}
