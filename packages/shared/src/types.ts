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

// Derived from ENTRY_TYPES constant so the type and runtime array stay in sync
import type { ENTRY_TYPES, ACTIVITY_EVENT_TYPES } from "./constants.js";
export type EntryType = (typeof ENTRY_TYPES)[number];
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

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

export interface ActivityLogEntry {
  id: number;
  eventType: string;
  entityType?: string;
  entityId?: number;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
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
  archivedAt?: string;
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
  archivedAt?: string;
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
  reviewNote?: string;
  reviewedAt?: string;
}

export interface ChoreTier {
  id: number;
  choreId: number;
  name: string;
  points: number;
  sortOrder: number;
  archivedAt?: string;
}

export interface Chore {
  id: number;
  name: string;
  requiresApproval: boolean;
  sortOrder: number;
  tiers: ChoreTier[];
  archivedAt?: string;
}

export interface ChoreLog {
  id: number;
  choreId: number;
  choreNameSnapshot: string;
  tierId: number;
  tierNameSnapshot: string;
  pointsSnapshot: number;
  requiresApprovalSnapshot: boolean;
  loggedAt: string;
  localDate: string;
  status: Status;
  idempotencyKey: string;
  reviewNote?: string;
  reviewedAt?: string;
}

export interface Reward {
  id: number;
  name: string;
  pointsCost: number;
  imageAssetId?: number;
  sortOrder: number;
  archivedAt?: string;
}

export interface RewardRequest {
  id: number;
  rewardId: number;
  rewardNameSnapshot: string;
  costSnapshot: number;
  requestedAt: string;
  localDate: string;
  status: Status;
  idempotencyKey: string;
  reviewNote?: string;
  reviewedAt?: string;
}

export type ApprovalType = "routine-completion" | "chore-log" | "reward-request";

export interface PendingApprovals {
  routineCompletions: RoutineCompletion[];
  choreLogs: ChoreLog[];
  rewardRequests: RewardRequest[];
}

export interface PointsBalance {
  total: number;
  reserved: number;
  available: number;
}

export interface LedgerEntry {
  id: number;
  entryType: EntryType;
  referenceTable: string | null;
  referenceId: number | null;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface Badge {
  id: number;
  badgeKey: string;
  earnedAt: string;
}

export interface BootstrapData {
  routines?: Routine[];
  pendingRoutineCount?: number;
  pendingChoreCount?: number;
  pointsSummary?: PointsBalance;
  pendingRewardCount?: number;
  recentBadges?: Badge[];
}
