import type Database from "better-sqlite3";
import type { ActivityEvent, ActivityLogEntry, ActivityEventType } from "@chore-app/shared";

interface ActivityRow {
  id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  summary: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface ActivityLogFilters {
  startDate?: string;
  endDate?: string;
  eventType?: string;
  page?: number;
  limit?: number;
}

export interface ActivityLogResult {
  events: ActivityLogEntry[];
  total: number;
}

export interface ActivityService {
  recordActivity(event: ActivityEvent): void;
  recordActivityOrThrow(event: ActivityEvent): void;
  getRecentActivity(limit?: number): ActivityEvent[];
  getLastApprovalAt(): string | undefined;
  getActivityLog(filters: ActivityLogFilters): ActivityLogResult;
}

export function createActivityService(db: Database.Database): ActivityService {
  const insertStmt = db.prepare(
    `INSERT INTO activity_events (event_type, entity_type, entity_id, summary, metadata_json)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const selectRecentStmt = db.prepare(
    `SELECT id, event_type, entity_type, entity_id, summary, metadata_json, created_at
     FROM activity_events
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
  );

  const selectLastApprovalStmt = db.prepare(
    `SELECT created_at FROM activity_events
     WHERE event_type IN ('routine_approved', 'chore_approved', 'reward_approved')
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
  );

  function recordActivity(event: ActivityEvent): void {
    try {
      insertStmt.run(
        event.eventType,
        event.entityType ?? null,
        event.entityId ?? null,
        event.summary ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
      );
    } catch (err) {
      console.error("Failed to record activity event:", err);
    }
  }

  function safeParseJson(raw: string): Record<string, unknown> | undefined {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  function getRecentActivity(limit = 20): ActivityEvent[] {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = selectRecentStmt.all(safeLimit) as ActivityRow[];
    return rows.map((row) => ({
      eventType: row.event_type,
      entityType: row.entity_type ?? undefined,
      entityId: row.entity_id ?? undefined,
      summary: row.summary ?? undefined,
      metadata: row.metadata_json ? safeParseJson(row.metadata_json) : undefined,
      createdAt: row.created_at,
    }));
  }

  // Lets errors propagate — use inside db.transaction() so failures trigger rollback
  function recordActivityOrThrow(event: ActivityEvent): void {
    insertStmt.run(
      event.eventType,
      event.entityType ?? null,
      event.entityId ?? null,
      event.summary ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
    );
  }

  function mapRowToLogEntry(row: ActivityRow): ActivityLogEntry {
    return {
      id: row.id,
      eventType: row.event_type as ActivityEventType,
      entityType: row.entity_type ?? undefined,
      entityId: row.entity_id ?? undefined,
      summary: row.summary ?? undefined,
      metadata: row.metadata_json ? safeParseJson(row.metadata_json) : undefined,
      createdAt: row.created_at,
    };
  }

  // Dynamic WHERE clause prevents caching a single prepared statement — better-sqlite3
  // caches compiled statements internally so repeated prepare() calls are near-free.
  function getActivityLog(filters: ActivityLogFilters): ActivityLogResult {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.eventType) {
      conditions.push("event_type = ?");
      params.push(filters.eventType);
    }
    if (filters.startDate) {
      conditions.push("created_at >= ?");
      params.push(filters.startDate + " 00:00:00");
    }
    if (filters.endDate) {
      conditions.push("created_at <= ?");
      params.push(filters.endDate + " 23:59:59");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
    const offset = Math.max(0, (filters.page ?? 0) * limit);

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM activity_events ${where}`)
      .get(...params) as { total: number };

    const rows = db
      .prepare(
        `SELECT id, event_type, entity_type, entity_id, summary, metadata_json, created_at
         FROM activity_events ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as ActivityRow[];

    return { events: rows.map(mapRowToLogEntry), total: countRow.total };
  }

  function getLastApprovalAt(): string | undefined {
    const row = selectLastApprovalStmt.get() as { created_at: string } | undefined;
    return row?.created_at;
  }

  return { recordActivity, recordActivityOrThrow, getRecentActivity, getLastApprovalAt, getActivityLog };
}
