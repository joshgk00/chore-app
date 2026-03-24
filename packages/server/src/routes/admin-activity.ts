import { Router } from "express";
import { ACTIVITY_EVENT_TYPES } from "@chore-app/shared";
import { ValidationError } from "../lib/errors.js";
import type { ActivityService } from "../services/activityService.js";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const validEventTypes = new Set<string>(ACTIVITY_EVENT_TYPES);

export function createAdminActivityRoutes(activityService: ActivityService) {
  const router = Router();

  router.get("/activity-log", (req, res, next) => {
    try {
      const { start_date, end_date, event_type, page, limit } = req.query;

      if (event_type !== undefined) {
        if (typeof event_type !== "string" || !validEventTypes.has(event_type)) {
          throw new ValidationError(
            `Invalid event_type. Must be one of: ${ACTIVITY_EVENT_TYPES.join(", ")}`,
          );
        }
      }

      if (start_date !== undefined) {
        if (typeof start_date !== "string" || !DATE_FORMAT.test(start_date)) {
          throw new ValidationError("start_date must be in YYYY-MM-DD format");
        }
      }

      if (end_date !== undefined) {
        if (typeof end_date !== "string" || !DATE_FORMAT.test(end_date)) {
          throw new ValidationError("end_date must be in YYYY-MM-DD format");
        }
      }

      const parsedPage = page !== undefined ? parseInt(String(page), 10) : 0;
      if (isNaN(parsedPage) || parsedPage < 0) {
        throw new ValidationError("page must be an integer >= 0");
      }

      const parsedLimit = limit !== undefined ? parseInt(String(limit), 10) : 50;
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
        throw new ValidationError("limit must be an integer between 1 and 200");
      }

      const result = activityService.getActivityLog({
        startDate: start_date as string | undefined,
        endDate: end_date as string | undefined,
        eventType: event_type as string | undefined,
        page: parsedPage,
        limit: parsedLimit,
      });

      res.json({
        data: {
          events: result.events,
          total: result.total,
          page: parsedPage,
          limit: parsedLimit,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
