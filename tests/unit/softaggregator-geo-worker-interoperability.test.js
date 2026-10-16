import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../ops/cloudflare/casino-geo-worker.js';
import { verifiedCasinoLocation } from '../../src/server/providers/softaggregator/edge-location';

const secret = 'betvima-geo-worker-cross-verification-test-secret-2026';
const origin = 'https://betvima.com';
const spoofed = {
  'x-betvima-geo-country': 'US',
  'x-betvima-geo-ip': '2001:db8::feed',
  'x-betvima-geo-timestamp': '1792116000',
  'x-betvima-geo-signature': 'f'.repeat(64),
};

function requestFromEdge({ path = '/api/v1/casino/launch', method = 'POST',
    country = 'DE', ip = '203.0.113.42', customHeaders = spoofed } = {}) {
  const request = new Request(origin + path, {
    method, headers: { ...customHeaders, 'cf-connecting-ip': ip },
  });
  // This is Cloudflare's trusted request.cf metadata, NOT a user header.
  Object.defineProperty(request, 'cf', { value: { country } });
  return request;
}

describe('SoftAggregator geo Worker and origin HMAC interoperability', () => {
  let forwarded;
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', vi.fn(async (request) => {
      forwarded = request;
      return new Response('proxied', { status: 200 });
    }));
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', 'DE');
    forwarded = null;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('signs Cloudflare-country launch and strips spoofed client attestation', async () => {
    await worker.fetch(requestFromEdge(), { CASINO_GEO_HMAC_SECRET: secret });
    expect(forwarded).not.toBeNull();
    expect(forwarded.headers.get('x-betvima-geo-country')).toBe('DE');
    expect(forwarded.headers.get('x-betvima-geo-ip')).toBe('203.0.113.42');
    expect(forwarded.headers.get('x-betvima-geo-signature')).not.toBe(spoofed['x-betvima-geo-signature']);
    expect(verifiedCasinoLocation(forwarded, { secret })).toBe('DE');
  });

  it('signs only GET eligibility and POST launch, and never signs games catalogue', async () => {
    await worker.fetch(requestFromEdge({
      path: '/api/v1/casino/eligibility', method: 'GET',
    }), { CASINO_GEO_HMAC_SECRET: secret });
    expect(verifiedCasinoLocation(forwarded, { secret })).toBe('DE');

    await worker.fetch(requestFromEdge({
      path: '/api/v1/casino/games', method: 'GET',
    }), { CASINO_GEO_HMAC_SECRET: secret });
    expect(forwarded.headers.has('x-betvima-geo-country')).toBe(false);
    expect(forwarded.headers.has('x-betvima-geo-signature')).toBe(false);
    expect(verifiedCasinoLocation(forwarded, { secret })).toBeNull();

    await worker.fetch(requestFromEdge({ method: 'GET' }),
      { CASINO_GEO_HMAC_SECRET: secret });
    expect(forwarded.headers.has('x-betvima-geo-signature')).toBe(false);
  });

  it('fails closed with missing signing secret or missing trusted country', async () => {
    await worker.fetch(requestFromEdge(), {});
    expect(forwarded.headers.has('x-betvima-geo-country')).toBe(false);
    expect(verifiedCasinoLocation(forwarded, { secret })).toBeNull();

    // Unknown Cloudflare geolocation must not authorize cash gaming.
    const unknown = requestFromEdge({ country: null });
    await worker.fetch(unknown, { CASINO_GEO_HMAC_SECRET: secret });
    expect(forwarded.headers.has('x-betvima-geo-signature')).toBe(false);
    expect(verifiedCasinoLocation(forwarded, { secret })).toBeNull();
  });

  it('does not treat a signed country as licensed when allowlist is unset', async () => {
    await worker.fetch(requestFromEdge(), { CASINO_GEO_HMAC_SECRET: secret });
    expect(verifiedCasinoLocation(forwarded, { secret })).toBe('DE');
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', '');
    expect(verifiedCasinoLocation(forwarded, { secret })).toBeNull();
  });

  it('fails if a valid edge token is moved to another endpoint', async () => {
    await worker.fetch(requestFromEdge(), { CASINO_GEO_HMAC_SECRET: secret });
    const otherPath = new Request(origin + '/api/v1/casino/eligibility', {
      method: 'GET', headers: forwarded.headers,
    });
    expect(verifiedCasinoLocation(otherPath, { secret })).toBeNull();
  });
});
