import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifiedCasinoLocation } from '@/server/providers/softaggregator/edge-location';

const secret = 'casino-geo-ci-test-only-shared-secret-0123456789';
const url = 'https://betvima.com/api/v1/casino/launch';

function edgeRequest(options: {
  country?: string;
  ip?: string;
  path?: string;
  method?: 'GET' | 'POST';
  timestamp?: number;
  forged?: boolean;
} = {}) {
  const country = options.country ?? 'DE';
  const ip = options.ip ?? '203.0.113.25';
  const target = options.path ?? url;
  const method = options.method ?? 'POST';
  const timestamp = String(options.timestamp ?? 1792116000);
  const canonical = ['v1', timestamp, method,
    new URL(target).pathname, country, ip].join('\n');
  const signature = createHmac('sha256', secret).update(canonical).digest('hex');
  const request = new Request(target, {
    method,
    headers: {
      'x-betvima-geo-country': country,
      'x-betvima-geo-ip': ip,
      'x-betvima-geo-timestamp': timestamp,
      'x-betvima-geo-signature': options.forged ? '0'.repeat(64) : signature,
    },
  });
  return request;
}

describe('SoftAggregator cash-game verified current geolocation', () => {
  beforeEach(() => {
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', 'DE,BR');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts only an explicitly licensed country with a valid edge HMAC', () => {
    const nowSeconds = 1792116000;
    expect(verifiedCasinoLocation(edgeRequest(), {secret, nowSeconds})).toBe('DE');
    expect(verifiedCasinoLocation(edgeRequest({country:'BR'}), {secret, nowSeconds})).toBe('BR');
    expect(verifiedCasinoLocation(edgeRequest({country:'FR'}), {secret, nowSeconds})).toBeNull();
  });

  it('refuses missing / weak secret and client-controlled IP and country headers', () => {
    const nowSeconds = 1792116000;
    expect(verifiedCasinoLocation(edgeRequest(), {secret:'short', nowSeconds})).toBeNull();
    expect(verifiedCasinoLocation(new Request(url, {
      method:'POST',
      headers:{
        'CF-IPCountry':'DE',
        'CF-Connecting-IP':'203.0.113.25',
        'X-Forwarded-For':'203.0.113.25',
      },
    }), {secret, nowSeconds})).toBeNull();
    expect(verifiedCasinoLocation(edgeRequest({forged:true}), {secret,nowSeconds})).toBeNull();
    expect(verifiedCasinoLocation(edgeRequest({ip:'spoofed-value'}), {secret,nowSeconds})).toBeNull();
  });

  it('does not accept a signature copied to a different path or HTTP method', () => {
    const nowSeconds = 1792116000;
    const request = edgeRequest();
    const moved = new Request('https://betvima.com/api/v1/casino/eligibility', {
      method:'POST',headers:request.headers,
    });
    const changedMethod = new Request(url, {method:'GET',headers:request.headers});
    expect(verifiedCasinoLocation(moved, {secret,nowSeconds})).toBeNull();
    expect(verifiedCasinoLocation(changedMethod,{secret,nowSeconds})).toBeNull();
  });

  it('fails closed when the signed timestamp has expired or is in the future', () => {
    const nowSeconds=1792116000;
    expect(verifiedCasinoLocation(edgeRequest({timestamp:nowSeconds-46}),
      {secret,nowSeconds})).toBeNull();
    expect(verifiedCasinoLocation(edgeRequest({timestamp:nowSeconds+46}),
      {secret,nowSeconds})).toBeNull();
    expect(verifiedCasinoLocation(edgeRequest({timestamp:nowSeconds-45}),
      {secret,nowSeconds})).toBe('DE');
  });

  it('rejects duplicates and wildcard operator rules', () => {
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', '*');
    expect(verifiedCasinoLocation(edgeRequest(), {secret,nowSeconds:1792116000})).toBeNull();
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', 'DE,DE');
    expect(verifiedCasinoLocation(edgeRequest(), {secret,nowSeconds:1792116000})).toBeNull();
  });
});
