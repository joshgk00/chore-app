import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '../../src/lib/crypto.js';

describe('crypto', () => {
  it('hashPin returns salt:hash format', () => {
    const hashed = hashPin('123456');
    expect(hashed).toContain(':');
    const parts = hashed.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('verifyPin returns true for correct PIN', () => {
    const hashed = hashPin('123456');
    expect(verifyPin('123456', hashed)).toBe(true);
  });

  it('verifyPin returns false for wrong PIN', () => {
    const hashed = hashPin('123456');
    expect(verifyPin('000000', hashed)).toBe(false);
  });

  it('two hashes of the same PIN produce different values (unique salts)', () => {
    const hash1 = hashPin('123456');
    const hash2 = hashPin('123456');
    expect(hash1).not.toBe(hash2);
  });
});
