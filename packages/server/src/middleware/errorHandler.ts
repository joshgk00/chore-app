import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
      },
    });
    return;
  }

  // Log unexpected errors but don't leak details
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
