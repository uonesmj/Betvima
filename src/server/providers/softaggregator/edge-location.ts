import { createHmac, timingSafeEqual } from 'node:crypto';
import { casinoCountryPermitted } from './jurisdiction';

const MAX_GEO_TOKEN_AGE_SECONDS = 45;

/**
 * Verify a short-lived statement signed at the trusted Cloudflare edge.
 * NEVER treat CF-IPCountry, X-Forwarded-For, or a client-provided country
 * as authoritative on their own: direct origin access and forged headers
 * must not authorize real-money wagering.
 *
 * Secret is shared only between the protected Cloudflare Worker and the
 * backend process. The client Android app does not receive it.
 */
export function verifiedCasinoLocation(
  request: Request,
  opts: { secret?: string; nowSeconds?: number } = {},
): string | null {
  const secret = opts.secret ?? process.env.CASINO_GEO_HMAC_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return null;

  const country = request.headers.get('x-betvima-geo-country') ?? '';
  const ip = request.headers.get('x-betvima-geo-ip') ?? '';
  const timestamp = request.headers.get('x-betvima-geo-timestamp') ?? '';
  const signature = request.headers.get('x-betvima-geo-signature') ?? '';
  if (!/^[A-Z]{2}$/.test(country) || !casinoCountryPermitted(country) ||
      !/^[a-fA-F0-9.:]{3,45}$/.test(ip) ||
      !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature))
    return null;

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const parsed = Number(timestamp);
  if (!Number.isSafeInteger(parsed) ||
      Math.abs(now - parsed) > MAX_GEO_TOKEN_AGE_SECONDS) return null;

  const url = new URL(request.url);
  // Bind to this endpoint and method; a token cannot be replayed on
  // the other API or reused with a user-chosen country.
  const canonical = ['v1', timestamp, request.method.toUpperCase(),
    url.pathname, country, ip].join('\n');
  const actual = Buffer.from(signature, 'hex');
  const expected = createHmac('sha256', secret).update(canonical).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  return country;
}
