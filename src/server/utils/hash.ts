/**
 * Server-side hashing for privacy-preserving fraud signals.
 * Raw IPs / emails / device strings are NEVER stored - only salted hashes.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SALT = process.env.SIGNAL_HASH_SALT ?? process.env.SESSION_SECRET ?? 'nova-local-salt';

export function hashSignal(value: string): string {
  return createHmac('sha256', SALT).update(value.trim().toLowerCase()).digest('hex');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time comparison for webhook signatures. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip');
}

/** Quote tokens: HMAC-signed payloads binding a price to the odds versions it was computed from. */
const QUOTE_SECRET = process.env.QUOTE_SIGNING_SECRET ?? process.env.SESSION_SECRET ?? 'nova-local-quote-secret';
const QUOTE_TTL_MS = 120_000;

export interface QuotePayload {
  userId: string; type: string; stakeMinor: string; currency: string; combinedOddsScaled: string; expiresAt: string;
  legs: { selectionId: string; oddsVersion: number; oddsScaled: string }[];
}

export function signQuote(payload: QuotePayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', QUOTE_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/** Returns the payload when the signature is valid and unexpired; throws otherwise. */
export function verifyQuote<T = QuotePayload>(token: string): T {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new Error('QUOTE_MALFORMED');
  const expected = createHmac('sha256', QUOTE_SECRET).update(body).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('QUOTE_SIGNATURE_INVALID');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as QuotePayload;
  if (new Date(payload.expiresAt).getTime() < Date.now()) throw new Error('QUOTE_EXPIRED');
  if (new Date(payload.expiresAt).getTime() > Date.now() + QUOTE_TTL_MS + 60_000) throw new Error('QUOTE_FUTURE_DATED');
  return payload as unknown as T;
}
