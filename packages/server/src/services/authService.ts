import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { SESSION_DURATION_MINUTES } from "@chore-app/shared";
import { verifyPin as verifyCryptoPin } from "../lib/crypto.js";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyPin(db: Database.Database, pin: string): boolean {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_pin_hash'").get() as
    | { value: string }
    | undefined;
  if (!row) return false;
  return verifyCryptoPin(pin, row.value);
}

export function createSession(db: Database.Database): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();

  db.prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)").run(
    tokenHash,
    expiresAt,
  );

  return { token, tokenHash };
}

export function validateSession(
  db: Database.Database,
  token: string,
): { id: number; tokenHash: string } | null {
  const tokenHash = hashToken(token);

  const session = db
    .prepare("SELECT id, token_hash, expires_at FROM admin_sessions WHERE token_hash = ?")
    .get(tokenHash) as { id: number; token_hash: string; expires_at: string } | undefined;

  if (!session) return null;

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    db.prepare("DELETE FROM admin_sessions WHERE id = ?").run(session.id);
    return null;
  }

  // Sliding window: extend expiry on each valid access
  const newExpiry = new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();
  db.prepare(
    "UPDATE admin_sessions SET last_seen_at = datetime(?), expires_at = ? WHERE id = ?",
  ).run(new Date().toISOString(), newExpiry, session.id);

  return { id: session.id, tokenHash: session.token_hash };
}

export function destroySession(db: Database.Database, token: string): void {
  const tokenHash = hashToken(token);
  db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
}

export function destroyAllSessions(db: Database.Database): void {
  db.prepare("DELETE FROM admin_sessions").run();
}
