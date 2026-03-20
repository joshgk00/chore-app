import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE_NAME } from "@chore-app/shared";
import { AuthError } from "../lib/errors.js";
import type { AuthService } from "../services/authService.js";

export function adminAuth(authService: AuthService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.cookies[SESSION_COOKIE_NAME];
      if (!token) {
        throw new AuthError("Admin authentication required");
      }

      const session = authService.validateSession(token);
      if (!session) {
        throw new AuthError("Invalid or expired session");
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
