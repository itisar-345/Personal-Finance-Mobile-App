import * as Crypto from 'expo-crypto';

// Stored format: v2$<rounds>$<salt>$<hash>. Older builds stored a bare 64-char hex SHA-256 of `fintrack::<pin>`.
// The rounds count travels with the hash, so raising it only affects newly-set PINs — existing hashes
// keep verifying against whatever count they were created with.
const ROUNDS = 10000;

async function sha256(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

async function stretch(pin: string, salt: string, rounds: number): Promise<string> {
  let digest = await sha256(`${salt}::${pin}`);
  for (let i = 1; i < rounds; i++) digest = await sha256(`${digest}${salt}`);
  return digest;
}

async function randomSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string): Promise<string> {
  const salt = await randomSalt();
  return `v2$${ROUNDS}$${salt}$${await stretch(pin, salt, ROUNDS)}`;
}

/** Constant-time string comparison to avoid leaking how many leading characters matched (CWE-208). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length === 4 && parts[0] === 'v2') {
    const rounds = Number(parts[1]);
    if (!Number.isInteger(rounds) || rounds < 1) return false;
    return safeEqual(await stretch(pin, parts[2], rounds), parts[3]);
  }
  return safeEqual(await sha256(`fintrack::${pin}`), stored);
}
