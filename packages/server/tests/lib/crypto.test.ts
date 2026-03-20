import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '../../src/lib/crypto.js';

describe('crypto', () => {
  it('hashPin returns salt:hash format', async () => {
    const hashed = await hashPin('123456');
    expect(hashed).toContain(':');
    const parts = hashed.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('verifyPin returns true for correct PIN', async () => {
    const hashed = await hashPin('123456');
    expect(await verifyPin('123456', hashed)).toBe(true);
  });

  it('verifyPin returns false for wrong PIN', async () => {
    const hashed = await hashPin('123456');
    expect(await verifyPin('000000', hashed)).toBe(false);
  });

  it('two hashes of the same PIN produce different values (unique salts)', async () => {
    const hash1 = await hashPin('123456');
    const hash2 = await hashPin('123456');
    expect(hash1).not.toBe(hash2);
  });

  it('verifyPin returns false for malformed stored hash', async () => {
    expect(await verifyPin('123456', 'nocolon')).toBe(false);
    expect(await verifyPin('123456', '')).toBe(false);
  });
});
