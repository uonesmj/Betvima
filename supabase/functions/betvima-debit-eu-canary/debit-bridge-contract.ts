/**
 * INERT / NOT DEPLOYED: strict ordinary USD Debit bridge contract only.
 *
 * This verifier does not perform SQL, wallet updates, receipt writes, or
 * payments. Future financial deployment must separately guarantee dual
 * SoftAggregator and trusted-edge signature validation at ingress, a
 * transactionally locked ledger+receipt, replay/idempotency protection, exact
 * live eligibility/caps, and safe rollback with the old VPS.
 */
export type OrdinaryDebitPayload = Readonly<{
  v: 1;
  kind: 'softaggregator_debit';
  ts: number;
  nonce: string;
  action: 'debit';
  username: string;
  currency: 'USD';
  call_id: string;
  amount: string;
  round_id: string;
  game_id: string;
  rollback: false;
  identity_hash: string;
}>;
export type DebitBridgeVerified =
  | { ok: true; payload: OrdinaryDebitPayload }
  | { ok: false; code: string };

const FIELD_NAMES = [
  'action', 'amount', 'call_id', 'currency', 'game_id',
  'identity_hash', 'kind', 'nonce', 'rollback', 'round_id',
  'ts', 'username', 'v',
].join(',');
const stop = (code: string): DebitBridgeVerified => ({ ok: false, code });

function strictB64(value: string, max: number): Uint8Array | null {
  if (!value || value.length > max || value.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  try {
    return Uint8Array.from(atob(value), c => c.charCodeAt(0));
  } catch {
    return null;
  }
}
function arrayBufferOf(input: Uint8Array): ArrayBuffer {
  const bytes = new ArrayBuffer(input.byteLength);
  new Uint8Array(bytes).set(input);
  return bytes;
}
function hex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyOrdinaryDebitBridge(
  body: Uint8Array,
  signatureB64: string,
  signerSpkiB64: string,
  actualRegion: string,
  now = Date.now(),
): Promise<DebitBridgeVerified> {
  if (actualRegion !== 'eu-west-1') return stop('REGION_INVALID');
  if (body.byteLength < 1 || body.byteLength > 2048) return stop('BODY_SIZE_INVALID');
  const keyBytes = strictB64(signerSpkiB64, 2048);
  const signature = strictB64(signatureB64, 256);
  if (!keyBytes || !signature || signature.length !== 64) return stop('INVALID_SIGNATURE_FORMAT');

  try {
    const key = await crypto.subtle.importKey(
      'spki', arrayBufferOf(keyBytes), { name: 'Ed25519' }, false, ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'Ed25519', key, arrayBufferOf(signature), arrayBufferOf(body),
    );
    if (!valid) return stop('BAD_SIGNATURE');
  } catch {
    return stop('SIGNATURE_VERIFY_FAILED');
  }

  let raw: string, parsed: unknown;
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(body);
    parsed = JSON.parse(raw);
  } catch {
    return stop('INVALID_JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return stop('INVALID_BODY');
  const p = parsed as Record<string, unknown>;
  if (Object.keys(p).sort().join(',') !== FIELD_NAMES) return stop('UNEXPECTED_FIELDS');
  // Prevent duplicate JSON keys, whitespace ambiguity or alternative signed
  // serializations from being interpreted differently by downstream handlers.
  if (JSON.stringify(p) !== raw) return stop('NONCANONICAL_BODY');
  if (p.v !== 1 || p.kind !== 'softaggregator_debit' ||
      p.action !== 'debit' || p.rollback !== false || p.currency !== 'USD')
    return stop('DEBIT_USD_ONLY');
  if (typeof p.ts !== 'number' || !Number.isSafeInteger(p.ts) ||
      Math.abs(now - p.ts) > 30_000 ||
      typeof p.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(p.nonce))
    return stop('STALE_OR_INVALID_NONCE');
  if (typeof p.username !== 'string' || !/^bv_[0-9a-f]{32}$/.test(p.username) ||
      typeof p.call_id !== 'string' || !/^[A-Za-z0-9_:./-]{1,160}$/.test(p.call_id) ||
      typeof p.round_id !== 'string' || p.round_id.length < 1 || p.round_id.length > 240 ||
      typeof p.game_id !== 'string' || p.game_id.length < 1 || p.game_id.length > 240)
    return stop('INVALID_IDENTITY_OR_ROUND');
  if (typeof p.amount !== 'string' || !/^[1-9]\d{0,14}$/.test(p.amount) ||
      BigInt(p.amount) > 1_000_000_000_000n)
    return stop('INVALID_AMOUNT');
  if (typeof p.identity_hash !== 'string' || !/^[a-f0-9]{64}$/.test(p.identity_hash))
    return stop('INVALID_CALLBACK_HASH');

  // Must match the existing server contract's SHA-256 of the exact supplier
  // callback identity. An attacker cannot sign a different amount/round for
  // an existing identity_hash without failing this check.
  const canonical = JSON.stringify({
    action: 'debit', username: p.username, currency: 'USD',
    callId: p.call_id, amount: p.amount, roundId: p.round_id,
    gameId: p.game_id, rollback: false,
  });
  const digest = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(canonical),
  );
  if (hex(new Uint8Array(digest)) !== p.identity_hash)
    return stop('CALLBACK_HASH_MISMATCH');

  return { ok: true, payload: p as OrdinaryDebitPayload };
}
