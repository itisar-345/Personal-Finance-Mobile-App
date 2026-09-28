import { describe, expect, it, vi } from 'vitest';

// expo-crypto needs a native bridge; stub it with a deterministic, Node-backed SHA-256 so the hashing
// *logic* in crypto.ts (salting, round-chaining, legacy fallback, constant-time compare) is what's under
// test, not the native module.
vi.mock('expo-crypto', () => {
  const { createHash, randomBytes } = require('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digestStringAsync: async (_algo: string, input: string) => createHash('sha256').update(input).digest('hex'),
    getRandomBytesAsync: async (n: number) => new Uint8Array(randomBytes(n)),
  };
});

const { hashPin, verifyPin } = await import('../crypto');

describe('hashPin / verifyPin', () => {
  it('verifies a PIN against its own freshly created hash', async () => {
    const hash = await hashPin('4242');
    await expect(verifyPin('4242', hash)).resolves.toBe(true);
  });

  it('rejects the wrong PIN', async () => {
    const hash = await hashPin('4242');
    await expect(verifyPin('0000', hash)).resolves.toBe(false);
  });

  it('salts each hash differently, even for the same PIN', async () => {
    const [a, b] = await Promise.all([hashPin('1234'), hashPin('1234')]);
    expect(a).not.toBe(b);
  });

  it('stores the rounds count in the hash so verification is self-describing', async () => {
    const hash = await hashPin('1234');
    const [version, rounds] = hash.split('$');
    expect(version).toBe('v2');
    expect(Number(rounds)).toBeGreaterThan(0);
  });

  it('still verifies a pre-v2 bare SHA-256 hash (legacy format)', async () => {
    const { createHash } = await import('node:crypto');
    const legacyHash = createHash('sha256').update('fintrack::9999').digest('hex');
    await expect(verifyPin('9999', legacyHash)).resolves.toBe(true);
    await expect(verifyPin('0000', legacyHash)).resolves.toBe(false);
  });

  it('rejects a malformed stored hash rather than throwing', async () => {
    await expect(verifyPin('1234', 'v2$not-a-number$salt$hash')).resolves.toBe(false);
  });
});
