import { Router } from "express";
import type { ApprovalService } from "../services/approvalService.js";
import { ValidationError } from "../lib/errors.js";
import { parseIdParam } from "../lib/parse-id-param.js";

const ALLOWED_TYPES = ["routine-completion", "chore-log", "reward-request"] as const;

function parseApprovalParams(params: { type: string; id: string }) {
  if (!ALLOWED_TYPES.includes(params.type as (typeof ALLOWED_TYPES)[number])) {
    throw new ValidationError("Invalid approval type");
  }
  return { type: params.type as (typeof ALLOWED_TYPES)[number], id: parseIdParam(params.id) };
}

function parseReviewNote(body: Record<string, unknown>): string | undefined {
  const rawNote = body.reviewNote;
  if (rawNote === undefined) return undefined;
  if (typeof rawNote !== "string") {
    throw new ValidationError("reviewNote must be a string");
  }
  const trimmed = rawNote.trim();
  if (trimmed.length > 500) {
    throw new ValidationError("reviewNote must be 500 characters or fewer");
  }
  return trimmed || undefined;
}

export function createAdminApprovalsRoutes(approvalService: ApprovalService) {
  const router = Router();

  router.get("/approvals", (_req, res, next) => {
    try {
      const pending = approvalService.getPendingApprovals();
      res.json({ data: pending });
    } catch (err) {
      next(err);
    }
  });

  router.post("/approvals/:type/:id/approve", (req, res, next) => {
    try {
      const { type, id } = parseApprovalParams(req.params as { type: string; id: string });
      const reviewNote = parseReviewNote(req.body);

      let data;
      if (type === "routine-completion") {
        data = approvalService.approveRoutineCompletion(id, reviewNote);
      } else if (type === "chore-log") {
        data = approvalService.approveChoreLog(id, reviewNote);
      } else {
        data = approvalService.approveRewardRequest(id, reviewNote);
      }

      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.post("/approvals/:type/:id/reject", (req, res, next) => {
    try {
      const { type, id } = parseApprovalParams(req.params as { type: string; id: string });
      const reviewNote = parseReviewNote(req.body);

      let data;
      if (type === "routine-completion") {
        data = approvalService.rejectRoutineCompletion(id, reviewNote);
      } else if (type === "chore-log") {
        data = approvalService.rejectChoreLog(id, reviewNote);
      } else {
        data = approvalService.rejectRewardRequest(id, reviewNote);
      }

      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
