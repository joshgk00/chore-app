import type { ActivityLogEntry, PointsBalance, LedgerEntry } from "@chore-app/shared";

export interface ActivityLogResponse {
  events: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface LedgerResponse {
  entries: LedgerEntry[];
  balance: PointsBalance;
}
