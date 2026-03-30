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
  eventType: ActivityEventType;
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
  imageUrl?: string;
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
  imageUrl?: string;
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
  imageUrl?: string;
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

export interface PushSubscribePayload {
  role: PushRole;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface BackupManifest {
  appVersion: string;
  schemaVersion: string;
  timezone: string;
  exportedAt: string;
}

export interface Asset {
  id: number;
  source: AssetSource;
  reusable: boolean;
  status: AssetStatus;
  originalFilename: string | null;
  storedFilename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  prompt: string | null;
  model: string | null;
  createdAt: string;
  archivedAt: string | null;
  url: string;
}

export interface AssetUsageItem {
  entityType: "routine" | "checklist_item" | "reward";
  entityId: number;
  entityName: string;
}

export interface AssetUsage {
  assetId: number;
  usedBy: AssetUsageItem[];
}

export interface TodayPointActivity {
  id: number;
  entryType: EntryType;
  amount: number;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface RoutineCompletionRate {
  routineId: number;
  routineName: string;
  timeSlot: TimeSlot;
  daysCompleted: number;
  totalDays: number;
}

export interface TimeSlotBreakdown {
  timeSlot: TimeSlot;
  completedCount: number;
  routineCount: number;
}

export interface RoutineHealthAnalytics {
  completionRates: RoutineCompletionRate[];
  timeSlotBreakdown: TimeSlotBreakdown[];
  streakDays: number;
}

export interface ChoreEngagementRate {
  choreId: number;
  choreName: string;
  submissionCount: number;
  approvedCount: number;
  totalPoints: number;
}

export interface SubmissionTrend {
  date: string;
  submissions: number;
}

export interface ChoreEngagementAnalytics {
  engagementRates: ChoreEngagementRate[];
  inactiveChores: Array<Pick<ChoreEngagementRate, 'choreId' | 'choreName'>>;
  submissionTrends: SubmissionTrend[];
  windowDays: number;
}

export interface BootstrapData {
  routines?: Routine[];
  pendingRoutineCount?: number;
  pendingChoreCount?: number;
  pointsSummary?: PointsBalance;
  pendingRewardCount?: number;
  recentBadges?: Badge[];
  slotConfig?: SlotConfig;
  lastApprovalAt?: string;
  todayActivity?: TodayPointActivity[];
}
