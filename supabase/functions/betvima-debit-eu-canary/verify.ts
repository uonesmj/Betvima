/** Cryptographic bridge identity for a *non-financial* Debit latency canary.
 * Only a signed synthetic marker may be accepted; no player or amount inputs.
 * The production bridge will require separate, reviewed replay/idempotency logic.
 */
export type CanaryVerification =
  | { ok: true; code: 'CANARY_AUTHENTICATED' }
  | { ok: false; code: string };

const reject = (code: string): CanaryVerification => ({ ok: false, code });

function decodeB64(input: string, maxChars: number): Uint8Array | null {
  if (!input || input.length > maxChars || input.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) return null;
  try { return Uint8Array.from(atob(input), c => c.charCodeAt(0)); }
  catch { return null; }
}

export async function verifyDebitEuCanary(
  bytes: Uint8Array,
  signatureB64: string,
  publicSpkiB64: string,
  region: string,
  now = Date.now(),
): Promise<CanaryVerification> {
  // Verify the independent signer, not merely a public Supabase anon JWT.
  if (region !== 'eu-west-1') return reject('UNEXPECTED_REGION');
  if (bytes.length < 1 || bytes.length > 512) return reject('BODY_SIZE_INVALID');
  const spki = decodeB64(publicSpkiB64, 2048);
  const signature = decodeB64(signatureB64, 256);
  if (!spki) return reject('PINNED_PUBLIC_KEY_INVALID');
  if (!signature || signature.length !== 64) return reject('INVALID_SIGNATURE_FORMAT');
  // Node 22 + Deno TS both require ArrayBuffer-backed cryptographic inputs.
  // Copy bytes rather than passing potentially shared ArrayBufferLike views.
  const asBuffer = (input: Uint8Array): ArrayBuffer => {
    const out = new ArrayBuffer(input.byteLength);
    new Uint8Array(out).set(input);
    return out;
  };
  try {
    const key = await crypto.subtle.importKey('spki', asBuffer(spki), { name: 'Ed25519' }, false, ['verify']);
    if (!await crypto.subtle.verify('Ed25519', key, asBuffer(signature), asBuffer(bytes))) {
      return reject('INVALID_SIGNATURE');
    }
  } catch {
    return reject('SIGNATURE_VERIFICATION_FAILED');
  }
  let obj: unknown;
  try {
    obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return reject('INVALID_JSON');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return reject('INVALID_CANARY');
  const p = obj as Record<string, unknown>;
  if (Object.keys(p).sort().join(',') !== 'kind,nonce,ts,v') return reject('SYNTHETIC_FIELDS_ONLY');
  if (p.v !== 1 || p.kind !== 'debit_eu_canary' ||
      typeof p.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(p.nonce)) {
    return reject('INVALID_CANARY');
  }
  if (typeof p.ts !== 'number' || !Number.isSafeInteger(p.ts) ||
      Math.abs(now - p.ts) > 30000) return reject('EXPIRED_CANARY');
  return { ok: true, code: 'CANARY_AUTHENTICATED' };
}
