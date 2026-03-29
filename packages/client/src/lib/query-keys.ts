import type { QueryClient } from "@tanstack/react-query";

export const queryKeys = {
  bootstrap: () => ["bootstrap"] as const,
  points: () => ["points"] as const,
  ledger: (limit?: number, offset?: number) =>
    limit !== undefined ? (["ledger", limit, offset] as const) : (["ledger"] as const),
  chores: () => ["chores"] as const,
  choreLog: (logId: number | null) => ["chore-log", logId] as const,
  routines: () => ["routines"] as const,
  routine: (id: number | undefined) => ["routines", id] as const,
  rewards: () => ["rewards"] as const,
  badges: () => ["badges"] as const,
  activity: (limit?: number) =>
    limit !== undefined ? (["activity", limit] as const) : (["activity"] as const),

  admin: {
    settings: () => ["admin", "settings"] as const,
    approvals: () => ["admin", "approvals"] as const,
    routines: () => ["admin", "routines"] as const,
    routine: (id: string | undefined) => ["admin", "routines", id] as const,
    chores: () => ["admin", "chores"] as const,
    chore: (id: string | undefined) => ["admin", "chores", id] as const,
    rewards: () => ["admin", "rewards"] as const,
    reward: (id: string | undefined) => ["admin", "rewards", id] as const,
    ledger: (filter?: string, page?: number) =>
      filter !== undefined
        ? (["admin", "ledger", filter, page] as const)
        : (["admin", "ledger"] as const),
    assets: (filters: Record<string, string>) =>
      ["admin", "assets", filters] as const,
    recentActivity: (limit: number) =>
      ["admin", "activity-log", "recent", limit] as const,
    routineAnalytics: () => ["admin", "routine-analytics"] as const,
    activityLog: (
      eventType: string,
      startDate: string,
      endDate: string,
      page: number,
    ) => ["admin", "activity-log", eventType, startDate, endDate, page] as const,
  },
} as const;

export function invalidatePointsRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap() });
  queryClient.invalidateQueries({ queryKey: queryKeys.points() });
  queryClient.invalidateQueries({ queryKey: queryKeys.ledger() });
}

export function invalidateBootstrapAndPoints(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap() });
  queryClient.invalidateQueries({ queryKey: queryKeys.points() });
}
