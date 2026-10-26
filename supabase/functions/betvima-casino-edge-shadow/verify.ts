/**
 * Supabase Edge: cryptographic transport check for a future BetVima casino
 * settlement bridge. Deliberately recognizes ONLY synthetic kind='probe'.
 *
 * This is NOT a financial endpoint. It never reads player data or changes
 * wallet, ledger, currency, eligibility, KYC, or casino receipts.
 *
 * A public Supabase anon JWT is only a gateway requirement; authorization
 * is the pinned, independent Ed25519 bridge public key.
 */

export type ProbeVerification =
  | { ok: true; code: 'PROBE_SIGNATURE_VERIFIED' }
  | { ok: false; code: string };

const failure = (code: string): ProbeVerification => ({ ok: false, code });

function strictBase64(text: string, maxChars: number): Uint8Array | null {
  if (!text || text.length > maxChars ||
      text.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function verifyBridgeShadowProbe(
  body: Uint8Array,
  signatureB64: string,
  publicKeySpkiB64: string,
  region: string,
  nowMs = Date.now(),
): Promise<ProbeVerification> {
  // An unset public key makes the function impossible to use, even by callers
  // who possess the publicly distributed Supabase anon JWT.
  const spki = strictBase64(publicKeySpkiB64, 2048);
  if (!spki) return failure('VERIFY_KEY_NOT_CONFIGURED');
  if (region !== 'eu-west-1') return failure('REGION_NOT_EU_WEST_1');
  if (body.byteLength < 1 || body.byteLength > 512) return failure('INVALID_BODY_SIZE');

  const signature = strictBase64(signatureB64, 256);
  if (!signature || signature.byteLength !== 64) return failure('INVALID_SIGNATURE_FORMAT');

  try {
    const publicKey = await crypto.subtle.importKey(
      'spki', spki, { name: 'Ed25519' }, false, ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'Ed25519' }, publicKey, signature, body,
    );
    if (!valid) return failure('INVALID_SIGNATURE');
  } catch {
    return failure('SIGNATURE_VERIFICATION_FAILED');
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    return failure('INVALID_SIGNED_JSON');
  }

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return failure('INVALID_PROBE');
  }
  const payload = envelope as Record<string, unknown>;
  // No financial fields whatsoever may enter this shadow endpoint.
  if (Object.keys(payload).sort().join(',') !== 'kind,nonce,ts,v') {
    return failure('SHADOW_PROBE_FIELDS_ONLY');
  }
  if (payload.v !== 1 || payload.kind !== 'probe' ||
      typeof payload.nonce !== 'string' ||
      !/^[a-f0-9]{32}$/.test(payload.nonce)) {
    return failure('INVALID_PROBE');
  }
  if (typeof payload.ts !== 'number' ||
      !Number.isSafeInteger(payload.ts) ||
      Math.abs(nowMs - payload.ts) > 30_000) {
    return failure('EXPIRED_PROBE');
  }
  // Replay protection for a future financial endpoint MUST use persistent,
  // atomic nonce or callback receipt handling. In-memory checks are unsafe.
  // Because this endpoint is read-only, no persistent nonce is necessary.
  return { ok: true, code: 'PROBE_SIGNATURE_VERIFIED' };
}
