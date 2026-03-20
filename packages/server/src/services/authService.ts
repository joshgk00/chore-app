import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { SESSION_DURATION_MINUTES } from "@chore-app/shared";
import { verifyPin as verifyCryptoPin } from "../lib/crypto.js";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AuthService {
  verifyPin(pin: string): Promise<boolean>;
  createSession(): { token: string; tokenHash: string };
  validateSession(token: string): { id: number; tokenHash: string } | null;
  destroySession(token: string): void;
  destroyAllSessions(): void;
}

export function createAuthService(db: Database.Database): AuthService {
  const selectPinStmt = db.prepare("SELECT value FROM settings WHERE key = 'admin_pin_hash'");
  const insertSessionStmt = db.prepare(
    "INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)",
  );
  const selectSessionStmt = db.prepare(
    "SELECT id, token_hash, expires_at FROM admin_sessions WHERE token_hash = ?",
  );
  const deleteSessionByIdStmt = db.prepare("DELETE FROM admin_sessions WHERE id = ?");
  const updateSessionStmt = db.prepare(
    "UPDATE admin_sessions SET last_seen_at = datetime(?), expires_at = ? WHERE id = ?",
  );
  const deleteSessionByHashStmt = db.prepare(
    "DELETE FROM admin_sessions WHERE token_hash = ?",
  );
  const deleteAllSessionsStmt = db.prepare("DELETE FROM admin_sessions");

  async function verifyPin(pin: string): Promise<boolean> {
    const row = selectPinStmt.get() as { value: string } | undefined;
    if (!row) return false;
    return verifyCryptoPin(pin, row.value);
  }

  function createSession(): { token: string; tokenHash: string } {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();

    insertSessionStmt.run(tokenHash, expiresAt);

    return { token, tokenHash };
  }

  function validateSession(token: string): { id: number; tokenHash: string } | null {
    const tokenHash = hashToken(token);

    const session = selectSessionStmt.get(tokenHash) as
      | { id: number; token_hash: string; expires_at: string }
      | undefined;

    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      deleteSessionByIdStmt.run(session.id);
      return null;
    }

    const newExpiry = new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();
    updateSessionStmt.run(new Date().toISOString(), newExpiry, session.id);

    return { id: session.id, tokenHash: session.token_hash };
  }

  function destroySession(token: string): void {
    const tokenHash = hashToken(token);
    deleteSessionByHashStmt.run(tokenHash);
  }

  function destroyAllSessions(): void {
    deleteAllSessionsStmt.run();
  }

  return { verifyPin, createSession, validateSession, destroySession, destroyAllSessions };
}
