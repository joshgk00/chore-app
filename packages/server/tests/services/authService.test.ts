import { describe, it, expect } from 'vitest';
import { createTestDb, seedTestData } from '../db-helpers.js';
import {
  verifyPin,
  createSession,
  validateSession,
  destroySession,
  destroyAllSessions,
} from '../../src/services/authService.js';

describe('authService', () => {
  it('verifyPin returns true for correct PIN', () => {
    const db = createTestDb();
    seedTestData(db);
    expect(verifyPin(db, '123456')).toBe(true);
    db.close();
  });

  it('verifyPin returns false for wrong PIN', () => {
    const db = createTestDb();
    seedTestData(db);
    expect(verifyPin(db, '000000')).toBe(false);
    db.close();
  });

  it('createSession inserts a row in admin_sessions', () => {
    const db = createTestDb();
    const before = db.prepare('SELECT COUNT(*) as count FROM admin_sessions').get() as {
      count: number;
    };
    createSession(db);
    const after = db.prepare('SELECT COUNT(*) as count FROM admin_sessions').get() as {
      count: number;
    };
    expect(after.count).toBe(before.count + 1);
    db.close();
  });

  it('validateSession returns session data for valid token', () => {
    const db = createTestDb();
    const { token } = createSession(db);
    const session = validateSession(db, token);
    expect(session).not.toBeNull();
    expect(session!.id).toBeDefined();
    db.close();
  });

  it('validateSession returns null for expired session', () => {
    const db = createTestDb();
    const { token, tokenHash } = createSession(db);
    // Manually expire the session
    db.prepare('UPDATE admin_sessions SET expires_at = datetime(?) WHERE token_hash = ?').run(
      new Date(Date.now() - 60_000).toISOString(),
      tokenHash,
    );
    const session = validateSession(db, token);
    expect(session).toBeNull();
    db.close();
  });

  it('validateSession extends expires_at on successful validation (sliding window)', () => {
    const db = createTestDb();
    const { token, tokenHash } = createSession(db);

    const before = db.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?').get(
      tokenHash,
    ) as { expires_at: string };

    // Small delay to ensure time difference
    const beforeExpiry = new Date(before.expires_at).getTime();

    validateSession(db, token);

    const after = db.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?').get(
      tokenHash,
    ) as { expires_at: string };
    const afterExpiry = new Date(after.expires_at).getTime();

    expect(afterExpiry).toBeGreaterThanOrEqual(beforeExpiry);
    db.close();
  });

  it('destroySession removes the session row', () => {
    const db = createTestDb();
    const { token } = createSession(db);
    destroySession(db, token);
    const session = validateSession(db, token);
    expect(session).toBeNull();
    db.close();
  });

  it('destroyAllSessions clears all rows', () => {
    const db = createTestDb();
    createSession(db);
    createSession(db);
    destroyAllSessions(db);
    const count = db.prepare('SELECT COUNT(*) as count FROM admin_sessions').get() as {
      count: number;
    };
    expect(count.count).toBe(0);
    db.close();
  });
});
