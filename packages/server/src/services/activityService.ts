import type Database from "better-sqlite3";
import type { ActivityEvent } from "@chore-app/shared";

interface ActivityRow {
  id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  summary: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface ActivityService {
  recordActivity(event: ActivityEvent): void;
  getRecentActivity(limit?: number): ActivityEvent[];
}

export function createActivityService(db: Database.Database): ActivityService {
  const insertStmt = db.prepare(
    `INSERT INTO activity_events (event_type, entity_type, entity_id, summary, metadata_json)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const selectRecentStmt = db.prepare(
    `SELECT id, event_type, entity_type, entity_id, summary, metadata_json, created_at
     FROM activity_events
     ORDER BY created_at DESC
     LIMIT ?`,
  );

  function recordActivity(event: ActivityEvent): void {
    insertStmt.run(
      event.eventType,
      event.entityType ?? null,
      event.entityId ?? null,
      event.summary ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
    );
  }

  function getRecentActivity(limit = 20): ActivityEvent[] {
    const rows = selectRecentStmt.all(limit) as ActivityRow[];
    return rows.map((row) => ({
      eventType: row.event_type,
      entityType: row.entity_type ?? undefined,
      entityId: row.entity_id ?? undefined,
      summary: row.summary ?? undefined,
      metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
      createdAt: row.created_at,
    }));
  }

  return { recordActivity, getRecentActivity };
}
