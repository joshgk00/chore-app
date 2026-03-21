import type { Response } from "express";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MINUTES } from "@chore-app/shared";
import type { AppConfig } from "../config.js";

function isLocalOrigin(publicOrigin: string): boolean {
  return publicOrigin.includes("localhost") || publicOrigin.includes("127.0.0.1");
}

export function getSessionCookieOptions(config: AppConfig) {
  return {
    httpOnly: true,
    secure: !isLocalOrigin(config.publicOrigin),
    sameSite: "strict" as const,
    path: "/api",
    maxAge: SESSION_DURATION_MINUTES * 60 * 1000,
  };
}

export function setSessionCookie(res: Response, token: string, config: AppConfig): void {
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(config));
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  const { maxAge: _maxAge, ...clearOptions } = getSessionCookieOptions(config);
  res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
}
