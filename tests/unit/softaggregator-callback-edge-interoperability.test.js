import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../ops/cloudflare/softaggregator-callback-worker.js';
import { validateCallback } from '../../src/server/providers/softaggregator/contract';

const origin = 'https://betvima.com';
const salt = 'vendor-time-only-salt-for-test-2026';
const edgeSecret = 'operator-independent-worker-HMAC-key-2026-SAFE-SYNTHETIC';
const allowedIP = '203.0.113.10';
const now = 1800000000000;

function callback(fields = {}, ip = allowedIP, header = 'f'.repeat(64)) {
  const timestamp = String(now / 1000);
  const parameters = new URLSearchParams({
    username: 'bv_7aa50699cba14767b7b4dcd644399816',
    currency: 'USD',
    action: 'debit',
    amount: '50',
    call_id: 'call-123',
    round_id: 'round-123',
    game_id: 'slot-demo',
    rb: '0',
    timestamp,
    key: createHash('md5').update(timestamp + salt).digest('hex'),
    ...fields,
  });
  return new Request(origin + '/api/webhooks/softaggregator?' + parameters, {
    headers: { 'cf-connecting-ip': ip, 'x-signature': header },
  });
}

function edgeEnv(overrides = {}) {
  return {
    SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS: allowedIP,
    SOFTAGGREGATOR_EDGE_HMAC_SECRET: edgeSecret,
    ...overrides,
  };
}

describe('SoftAggregator trusted Cloudflare ingress interoperability', () => {
  let forwarded;
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', vi.fn(async req => {
      forwarded = req;
      return new Response(JSON.stringify({error:0,balance:250}), {status:200});
    }));
    forwarded = null;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('authenticates whole vendor GET after an exact source IP admission', async () => {
    const result = await worker.fetch(callback(), edgeEnv());
    expect(result.status).toBe(200);
    expect(forwarded).not.toBeNull();
    const sig = forwarded.headers.get('x-signature');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(sig).not.toBe('f'.repeat(64));
    const event = validateCallback(new URL(forwarded.url), sig, salt, now, edgeSecret);
    expect(event?.action).toBe('debit');
    expect(event?.amountMinor).toBe(50n);
  });

  it('rejects tampering of amount, player and rollback after trusted ingress', async () => {
    await worker.fetch(callback(), edgeEnv());
    const signed = forwarded.headers.get('x-signature');
    for (const [key, value] of [['amount', '900'], ['username', 'bv_00000000000000000000000000000001'], ['rb', '1']]) {
      const changed = new URL(forwarded.url);
      changed.searchParams.set(key, value);
      expect(validateCallback(changed, signed, salt, now, edgeSecret)).toBeNull();
    }
    expect(validateCallback(new URL(forwarded.url), 'f'.repeat(64), salt, now, edgeSecret)).toBeNull();
  });

  it('blocks unknown IPs, unset IP allowlist, or missing independent secret', async () => {
    for (const [req, env] of [
      [callback({}, '203.0.113.99'), edgeEnv()],
      [callback(), edgeEnv({SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS: ''})],
      [callback(), edgeEnv({SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS: '*'})],
      [callback(), edgeEnv({SOFTAGGREGATOR_EDGE_HMAC_SECRET: ''})],
    ]) {
      forwarded = null;
      const response = await worker.fetch(req, env);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({error:2,balance:0});
      expect(forwarded).toBeNull();
    }
  });

  it('rejects an invalid vendor MD5 at the protected backend', async () => {
    const req = callback({key: '0'.repeat(32)});
    await worker.fetch(req, edgeEnv());
    expect(validateCallback(new URL(forwarded.url), forwarded.headers.get('x-signature'),
      salt, now, edgeSecret)).toBeNull();
  });

  it('rejects duplicate query keys before ever forwarding', async () => {
    const req = callback();
    const url = new URL(req.url);
    url.searchParams.append('amount', '999');
    const response = await worker.fetch(new Request(url, {headers: req.headers}), edgeEnv());
    expect(await response.json()).toEqual({error:2,balance:0});
    expect(forwarded).toBeNull();
  });

  it('does not sign unrelated routes or POST callbacks', async () => {
    const other = new Request(origin + '/api/v1/casino/eligibility', {
      headers: {'cf-connecting-ip': allowedIP},
    });
    expect((await worker.fetch(other, edgeEnv())).status).toBe(200);
    expect(forwarded).toBeNull();
    const post = new Request(origin + '/api/webhooks/softaggregator', {
      method: 'POST', headers: {'cf-connecting-ip': allowedIP},
    });
    expect((await worker.fetch(post, edgeEnv())).status).toBe(200);
    expect(forwarded).toBeNull();
  });
});
