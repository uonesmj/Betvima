import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../ops/cloudflare/casino-geo-worker.js';
import { verifiedCasinoLocation } from '../../src/server/providers/softaggregator/edge-location';

const SECRET = 'synthetic-edge-test-hmac-shared-secret-1234567890';
const URL = 'https://betvima.com/api/v1/casino/launch';
let forwarded;

function request(country, spoof = false) {
  const headers = new Headers({
    'cf-connecting-ip': '203.0.113.24',
    authorization: 'Bearer dummy-authorization',
  });
  if (spoof) {
    headers.set('x-betvima-geo-country', 'DE');
    headers.set('x-betvima-geo-ip', '203.0.113.1');
    headers.set('x-betvima-geo-timestamp', String(Math.floor(Date.now()/1000)));
    headers.set('x-betvima-geo-signature', 'f'.repeat(64));
  }
  const req = new Request(URL, { method: 'POST', headers,
    body: JSON.stringify({gameId:'demo-game',demo:false}) });
  if (country !== undefined) Object.defineProperty(req, 'cf', {value:{country}});
  return req;
}

describe('real Cloudflare Worker <-> BetVima backend cash-country integration', () => {
  beforeEach(() => {
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES','DE');
    forwarded = null;
    vi.stubGlobal('fetch', vi.fn(async (req) => {
      forwarded = req;
      return new Response('forwarded',{
        headers: {'Cache-Control':'no-store'},
      });
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('signs Cloudflare observed country and IP, preserves auth+POST body, accepted by the actual server verifier', async () => {
    const response = await worker.fetch(request('DE',true),{CASINO_GEO_HMAC_SECRET:SECRET});
    expect(response.status).toBe(200);
    expect(forwarded.headers.get('authorization')).toBe('Bearer dummy-authorization');
    expect(await forwarded.clone().json()).toEqual({gameId:'demo-game',demo:false});
    expect(forwarded.headers.get('x-betvima-geo-country')).toBe('DE');
    expect(forwarded.headers.get('x-betvima-geo-ip')).toBe('203.0.113.24');
    expect(forwarded.headers.get('x-betvima-geo-signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(verifiedCasinoLocation(forwarded,{secret:SECRET})).toBe('DE');
    expect(verifiedCasinoLocation(forwarded,{secret:'a'.repeat(64)})).toBeNull();
  });

  it('strips all user-forged attestations when real Cloudflare country is unavailable', async () => {
    await worker.fetch(request(undefined,true),{CASINO_GEO_HMAC_SECRET:SECRET});
    for(const header of ['x-betvima-geo-country','x-betvima-geo-ip',
      'x-betvima-geo-timestamp','x-betvima-geo-signature']) {
      expect(forwarded.headers.has(header)).toBe(false);
    }
    expect(verifiedCasinoLocation(forwarded,{secret:SECRET})).toBeNull();
  });

  it('continues demo proxy without attestation if Worker secret is not installed', async () => {
    await worker.fetch(request('DE',true),{CASINO_GEO_HMAC_SECRET:''});
    expect(forwarded.headers.has('x-betvima-geo-signature')).toBe(false);
    expect(verifiedCasinoLocation(forwarded,{secret:SECRET})).toBeNull();
  });

  it('does not grant a real-money market just because Cloudflare can locate it', async () => {
    await worker.fetch(request('FR',true),{CASINO_GEO_HMAC_SECRET:SECRET});
    expect(forwarded.headers.get('x-betvima-geo-country')).toBe('FR');
    expect(verifiedCasinoLocation(forwarded,{secret:SECRET})).toBeNull();
  });
});
