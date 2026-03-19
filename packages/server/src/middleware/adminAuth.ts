import type { Request, Response, NextFunction } from "express";
import type Database from "better-sqlite3";
import { SESSION_COOKIE_NAME } from "@chore-app/shared";
import { AuthError } from "../lib/errors.js";
import { validateSession } from "../services/authService.js";

export function adminAuth(db: Database.Database) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.cookies[SESSION_COOKIE_NAME];
      if (!token) {
        throw new AuthError("Admin authentication required");
      }

      const session = validateSession(db, token);
      if (!session) {
        throw new AuthError("Invalid or expired session");
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
