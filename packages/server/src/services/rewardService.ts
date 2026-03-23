import type Database from "better-sqlite3";
import type { Reward, RewardRequest, Status } from "@chore-app/shared";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import type { ActivityService } from "./activityService.js";

export interface SubmitRewardRequestData {
  rewardId: number;
  idempotencyKey: string;
  localDate: string;
}

export interface CreateRewardData {
  name: string;
  pointsCost: number;
  sortOrder: number;
}

export interface UpdateRewardData {
  name?: string;
  pointsCost?: number;
  sortOrder?: number;
}

export interface RewardService {
  getActiveRewards(): Reward[];
  submitRequest(data: SubmitRewardRequestData): RewardRequest;
  cancelRequest(requestId: number): RewardRequest;
  getPendingRewardRequestCount(): number;
  listRewardsAdmin(): Reward[];
  getRewardAdmin(id: number): Reward;
  createReward(data: CreateRewardData): Reward;
  updateReward(id: number, data: UpdateRewardData): Reward;
  archiveReward(id: number): void;
  unarchiveReward(id: number): void;
}

interface RewardRow {
  id: number;
  name: string;
  points_cost: number;
  image_asset_id: number | null;
  active: number;
  sort_order: number;
  archived_at: string | null;
}

interface RequestRow {
  id: number;
  reward_id: number;
  reward_name_snapshot: string;
  cost_snapshot: number;
  requested_at: string;
  local_date: string;
  status: string;
  idempotency_key: string;
}

function mapRewardRow(row: RewardRow): Reward {
  return {
    id: row.id,
    name: row.name,
    pointsCost: row.points_cost,
    imageAssetId: row.image_asset_id ?? undefined,
    sortOrder: row.sort_order,
  };
}

function mapRewardRowAdmin(row: RewardRow): Reward {
  return {
    id: row.id,
    name: row.name,
    pointsCost: row.points_cost,
    imageAssetId: row.image_asset_id ?? undefined,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at ?? undefined,
  };
}

function mapRequestRow(row: RequestRow): RewardRequest {
  return {
    id: row.id,
    rewardId: row.reward_id,
    rewardNameSnapshot: row.reward_name_snapshot,
    costSnapshot: row.cost_snapshot,
    requestedAt: row.requested_at,
    localDate: row.local_date,
    status: row.status as Status,
    idempotencyKey: row.idempotency_key,
  };
}

export function createRewardService(
  db: Database.Database,
  activityService: ActivityService,
): RewardService {
  const selectActiveRewardsStmt = db.prepare(
    `SELECT id, name, points_cost, image_asset_id, active, sort_order, archived_at
     FROM rewards
     WHERE active = 1 AND archived_at IS NULL
     ORDER BY sort_order ASC`,
  );

  const selectRewardByIdStmt = db.prepare(
    `SELECT id, name, points_cost, image_asset_id, active, sort_order, archived_at
     FROM rewards
     WHERE id = ?`,
  );

  const selectRequestByKeyStmt = db.prepare(
    `SELECT id, reward_id, reward_name_snapshot, cost_snapshot, requested_at,
            local_date, status, idempotency_key
     FROM reward_requests
     WHERE idempotency_key = ?`,
  );

  const insertRequestStmt = db.prepare(
    `INSERT INTO reward_requests
       (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  );

  const selectRequestByIdStmt = db.prepare(
    `SELECT id, reward_id, reward_name_snapshot, cost_snapshot, requested_at,
            local_date, status, idempotency_key
     FROM reward_requests
     WHERE id = ?`,
  );

  const selectAvailablePointsStmt = db.prepare(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM points_ledger), 0)
       - COALESCE((SELECT SUM(cost_snapshot) FROM reward_requests WHERE status = 'pending'), 0)
       AS available`,
  );

  const cancelRequestStmt = db.prepare(
    `UPDATE reward_requests SET status = 'canceled', canceled_at = datetime('now') WHERE id = ?`,
  );

  const countPendingStmt = db.prepare(
    `SELECT COUNT(*) as count FROM reward_requests WHERE status = 'pending'`,
  );

  const selectAllRewardsStmt = db.prepare(
    `SELECT id, name, points_cost, image_asset_id, active, sort_order, archived_at
     FROM rewards
     ORDER BY sort_order ASC`,
  );

  const insertRewardStmt = db.prepare(
    `INSERT INTO rewards (name, points_cost, sort_order)
     VALUES (?, ?, ?)`,
  );

  const updateRewardStmt = db.prepare(
    `UPDATE rewards SET name = ?, points_cost = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`,
  );

  const archiveRewardStmt = db.prepare(
    `UPDATE rewards SET archived_at = datetime('now'), active = 0, updated_at = datetime('now')
     WHERE id = ? AND active = 1 AND archived_at IS NULL`,
  );

  const unarchiveRewardStmt = db.prepare(
    `UPDATE rewards SET archived_at = NULL, active = 1, updated_at = datetime('now')
     WHERE id = ? AND active = 0 AND archived_at IS NOT NULL`,
  );

  function getActiveRewards(): Reward[] {
    const rows = selectActiveRewardsStmt.all() as RewardRow[];
    return rows.map(mapRewardRow);
  }

  const submitRequestTx = db.transaction((data: SubmitRewardRequestData): RewardRequest => {
    const existingRequest = selectRequestByKeyStmt.get(
      data.idempotencyKey,
    ) as RequestRow | undefined;
    if (existingRequest) {
      return mapRequestRow(existingRequest);
    }

    const reward = selectRewardByIdStmt.get(data.rewardId) as RewardRow | undefined;
    if (!reward || reward.active === 0 || reward.archived_at !== null) {
      throw new ConflictError("archived");
    }

    const { available } = selectAvailablePointsStmt.get() as { available: number };
    if (available < reward.points_cost) {
      throw new ConflictError("insufficient_points");
    }

    let requestId: number;
    try {
      const result = insertRequestStmt.run(
        data.rewardId,
        reward.name,
        reward.points_cost,
        data.localDate,
        data.idempotencyKey,
      );
      requestId = Number(result.lastInsertRowid);
    } catch (err: unknown) {
      const sqliteErr = err as { code?: string; message?: string };
      if (
        (sqliteErr.code === "SQLITE_CONSTRAINT_UNIQUE" ||
          sqliteErr.code === "SQLITE_CONSTRAINT") &&
        sqliteErr.message?.includes("idempotency_key")
      ) {
        const existing = selectRequestByKeyStmt.get(
          data.idempotencyKey,
        ) as RequestRow;
        return mapRequestRow(existing);
      }
      throw err;
    }

    activityService.recordActivityOrThrow({
      eventType: "reward_requested",
      entityType: "reward_request",
      entityId: requestId,
      summary: `Requested ${reward.name} for ${reward.points_cost} points`,
    });

    const inserted = selectRequestByIdStmt.get(requestId) as RequestRow;
    return mapRequestRow(inserted);
  });

  function submitRequest(data: SubmitRewardRequestData): RewardRequest {
    return submitRequestTx(data);
  }

  const cancelRequestTx = db.transaction((requestId: number): RewardRequest => {
    const request = selectRequestByIdStmt.get(requestId) as RequestRow | undefined;
    if (!request) {
      throw new NotFoundError("Reward request not found");
    }

    if (request.status === "canceled") {
      return mapRequestRow(request);
    }

    if (request.status === "approved" || request.status === "rejected") {
      throw new ConflictError("cannot_cancel");
    }

    cancelRequestStmt.run(requestId);

    activityService.recordActivityOrThrow({
      eventType: "reward_canceled",
      entityType: "reward_request",
      entityId: requestId,
      summary: `Canceled reward request: ${request.reward_name_snapshot}`,
    });

    const updated = selectRequestByIdStmt.get(requestId) as RequestRow;
    return mapRequestRow(updated);
  });

  function cancelRequest(requestId: number): RewardRequest {
    return cancelRequestTx(requestId);
  }

  function getPendingRewardRequestCount(): number {
    const row = countPendingStmt.get() as { count: number };
    return row.count;
  }

  function listRewardsAdmin(): Reward[] {
    const rows = selectAllRewardsStmt.all() as RewardRow[];
    return rows.map(mapRewardRowAdmin);
  }

  function getRewardAdmin(id: number): Reward {
    const row = selectRewardByIdStmt.get(id) as RewardRow | undefined;
    if (!row) {
      throw new NotFoundError("Reward not found");
    }
    return mapRewardRowAdmin(row);
  }

  const createRewardTx = db.transaction((data: CreateRewardData): Reward => {
    if (data.name.trim().length === 0) {
      throw new ValidationError("Name is required");
    }

    const result = insertRewardStmt.run(
      data.name.trim(),
      data.pointsCost,
      data.sortOrder,
    );
    const rewardId = Number(result.lastInsertRowid);

    return getRewardAdmin(rewardId);
  });

  function createReward(data: CreateRewardData): Reward {
    return createRewardTx(data);
  }

  const updateRewardTx = db.transaction((id: number, data: UpdateRewardData): Reward => {
    const existing = selectRewardByIdStmt.get(id) as RewardRow | undefined;
    if (!existing) {
      throw new NotFoundError("Reward not found");
    }
    if (existing.archived_at !== null) {
      throw new ConflictError("Cannot update an archived reward. Unarchive it first.");
    }

    const newName = data.name !== undefined ? data.name : existing.name;
    const newPointsCost = data.pointsCost !== undefined ? data.pointsCost : existing.points_cost;
    const newSortOrder = data.sortOrder !== undefined ? data.sortOrder : existing.sort_order;

    if (newName.trim().length === 0) {
      throw new ValidationError("Name is required");
    }

    updateRewardStmt.run(
      newName.trim(),
      newPointsCost,
      newSortOrder,
      id,
    );

    return getRewardAdmin(id);
  });

  function updateReward(id: number, data: UpdateRewardData): Reward {
    return updateRewardTx(id, data);
  }

  function archiveReward(id: number): void {
    const result = archiveRewardStmt.run(id);
    if (result.changes === 0) {
      const existing = selectRewardByIdStmt.get(id) as RewardRow | undefined;
      if (!existing) {
        throw new NotFoundError("Reward not found");
      }
      throw new ConflictError("Reward is already archived");
    }
  }

  function unarchiveReward(id: number): void {
    const result = unarchiveRewardStmt.run(id);
    if (result.changes === 0) {
      const existing = selectRewardByIdStmt.get(id) as RewardRow | undefined;
      if (!existing) {
        throw new NotFoundError("Reward not found");
      }
      throw new ConflictError("Reward is not archived");
    }
  }

  return {
    getActiveRewards,
    submitRequest,
    cancelRequest,
    getPendingRewardRequestCount,
    listRewardsAdmin,
    getRewardAdmin,
    createReward,
    updateReward,
    archiveReward,
    unarchiveReward,
  };
}
