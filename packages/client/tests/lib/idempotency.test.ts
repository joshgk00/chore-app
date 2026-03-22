import { describe, it, expect } from 'vitest';
import { generateKey } from '../../src/lib/idempotency.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('idempotency', () => {
  it('generates a valid UUID v4 string', () => {
    const key = generateKey();
    expect(key).toMatch(UUID_REGEX);
  });

  it('produces different keys on successive calls', () => {
    const keys = Array.from({ length: 10 }, generateKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(10);
  });
});
