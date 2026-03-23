import { Router } from "express";
import type { ApprovalService } from "../services/approvalService.js";
import { ValidationError } from "../lib/errors.js";

const ALLOWED_TYPES = ["routine-completion", "chore-log", "reward-request"] as const;

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
      const { type, id: idParam } = req.params;

      if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
        throw new ValidationError("Invalid approval type");
      }
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid ID");
      }

      const { reviewNote: rawNote } = req.body;
      let reviewNote: string | undefined;
      if (rawNote !== undefined) {
        if (typeof rawNote !== "string") {
          throw new ValidationError("reviewNote must be a string");
        }
        const trimmed = rawNote.trim();
        if (trimmed.length > 500) {
          throw new ValidationError("reviewNote must be 500 characters or fewer");
        }
        reviewNote = trimmed || undefined;
      }

      const id = Number(idParam);
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
      const { type, id: idParam } = req.params;

      if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
        throw new ValidationError("Invalid approval type");
      }
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid ID");
      }

      const { reviewNote: rawNote } = req.body;
      let reviewNote: string | undefined;
      if (rawNote !== undefined) {
        if (typeof rawNote !== "string") {
          throw new ValidationError("reviewNote must be a string");
        }
        const trimmed = rawNote.trim();
        if (trimmed.length > 500) {
          throw new ValidationError("reviewNote must be 500 characters or fewer");
        }
        reviewNote = trimmed || undefined;
      }

      const id = Number(idParam);
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
