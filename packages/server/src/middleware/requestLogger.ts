import type { Request, Response, NextFunction } from "express";
import { getLogger } from "../lib/logger.js";

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/api/health") return next();

    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const log = getLogger();

      const data = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        ip: req.ip,
      };

      if (res.statusCode >= 500) {
        log.error(data, "request failed");
      } else if (res.statusCode >= 400) {
        log.warn(data, "request error");
      } else {
        log.info(data, "request completed");
      }
    });

    next();
  };
}
