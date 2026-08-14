const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPin(pin: string): Promise<string> {
  const data = encoder.encode(`fintrack::${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const h = await hashPin(pin);
  // Constant-time comparison to prevent timing attacks (CWE-208)
  const a = new TextEncoder().encode(h);
  const b = new TextEncoder().encode(hash);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
