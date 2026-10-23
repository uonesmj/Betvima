import { createHash, createHmac, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../ops/cloudflare/softaggregator-callback-worker.js';
import { validateCallback, verifySupplierCallbackSignature } from '../../src/server/providers/softaggregator/contract';

const origin = 'https://betvima.com';
const edgeHost = 'https://betvima-casino-callback.mimmim283228.workers.dev';
const salt = 'vendor-time-only-salt-for-test-2026';
const edgeSecret = 'operator-independent-worker-HMAC-key-2026-SAFE-SYNTHETIC';
const allowedIP = '203.0.113.10';
const now = 1800000000000;

function callback(fields = {}, ip = allowedIP, header = null) {
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
  const supplierCanonical = [...parameters.entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, value]) => name + '=' + value).join('&');
  const signature = createHmac('sha256', salt).update(supplierCanonical).digest('hex');
  return new Request(origin + '/api/webhooks/softaggregator?' + parameters, {
    headers: { 'cf-connecting-ip': ip, 'x-signature': header ?? signature },
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
      return new Response(JSON.stringify({error:0,balance:250}), {
        status:200, headers:{'content-type':'application/json'}
      });
    }));
    forwarded = null;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('authenticates whole vendor GET after an exact source IP admission', async () => {
    const result = await worker.fetch(callback(), edgeEnv());
    expect(result.status).toBe(200);
    expect(forwarded).not.toBeNull();
    const supplierSig = forwarded.headers.get('x-signature');
    const edgeSig = forwarded.headers.get('x-betvima-edge-signature');
    expect(supplierSig).toMatch(/^[a-f0-9]{64}$/);
    expect(edgeSig).toMatch(/^[a-f0-9]{64}$/);
    expect(edgeSig).not.toBe(supplierSig);
    expect(verifySupplierCallbackSignature(new URL(forwarded.url), supplierSig, salt)).toBe(true);
    const event = validateCallback(new URL(forwarded.url), edgeSig, salt, now, edgeSecret);
    expect(event?.action).toBe('debit');
    expect(event?.amountMinor).toBe(50n);
  });


  it('forwards workers.dev GET requests to the fixed HTTPS BetVima origin, not itself', async () => {
    const original = callback();
    const headers = new Headers(original.headers);
    headers.set('cookie', 'untrusted-user-cookie=must-not-forward');
    headers.set('authorization', 'Bearer must-not-forward');
    headers.set('x-betvima-edge-signature', 'f'.repeat(64));
    const request = new Request(original.url.replace(origin, edgeHost), { headers });

    const response = await worker.fetch(request, edgeEnv());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({error:0,balance:250});
    expect(new URL(forwarded.url).origin).toBe(origin);
    expect(new URL(forwarded.url).pathname).toBe('/api/webhooks/softaggregator');
    expect(forwarded.redirect).toBe('manual');
    expect(forwarded.headers.get('cookie')).toBeNull();
    expect(forwarded.headers.get('authorization')).toBeNull();
    expect(forwarded.headers.get('cf-connecting-ip')).toBeNull();
    expect(forwarded.headers.get('x-betvima-edge-signature')).not.toBe('f'.repeat(64));
    expect(verifySupplierCallbackSignature(
      new URL(forwarded.url), forwarded.headers.get('x-signature'), salt
    )).toBe(true);
    expect(validateCallback(
      new URL(forwarded.url), forwarded.headers.get('x-betvima-edge-signature'),
      salt, now, edgeSecret,
    )?.amountMinor).toBe(50n);
  });

  it('never treats the site root as a callback on the production hostname', async () => {
    const original = callback();
    const root = new Request(origin + '/?' + new URL(original.url).searchParams, {
      headers: original.headers,
    });
    const result = await worker.fetch(root, edgeEnv());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({error:2,balance:0});
    expect(forwarded).toBeNull();
  });

  it('accepts the dedicated Worker root and forwards to the protected callback path', async () => {
    const original = callback();
    const req = new Request(edgeHost + '/?' + new URL(original.url).searchParams, {
      headers: original.headers,
    });
    const response = await worker.fetch(req, edgeEnv());
    expect(await response.json()).toEqual({error:0,balance:250});
    expect(new URL(forwarded.url).pathname).toBe('/api/webhooks/softaggregator');
    expect(verifySupplierCallbackSignature(
      new URL(forwarded.url), forwarded.headers.get('x-signature'), salt
    )).toBe(true);
  });

  it('denies other workers.dev hosts and unknown IPs before forwarding', async () => {
    const original = callback();
    for (const [hostname, ip] of [
      ['https://not-allowed.workers.dev', allowedIP],
      [edgeHost, '203.0.113.99'],
    ]) {
      forwarded = null;
      const req = new Request(original.url.replace(origin, hostname), {
        headers: { 'cf-connecting-ip': ip, 'x-signature': original.headers.get('x-signature') },
      });
      expect(await (await worker.fetch(req, edgeEnv())).json())
        .toEqual({error:2,balance:0});
      expect(forwarded).toBeNull();
    }
  });

  it('fails closed on a workers.dev upstream redirect or non-JSON response', async () => {
    const original = callback();
    const req = new Request(original.url.replace(origin, edgeHost), {headers:original.headers});
    vi.stubGlobal('fetch', vi.fn(async () => Response.redirect('https://attacker.invalid', 302)));
    expect(await (await worker.fetch(req, edgeEnv())).json()).toEqual({error:2,balance:0});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>error</html>', {status:200})));
    expect(await (await worker.fetch(req, edgeEnv())).json()).toEqual({error:2,balance:0});
  });

  it('logs only fixed diagnostic stages for trusted provider ingress and origin HTTP responses', async () => {
    const traceLog = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const original = callback();
      const req = new Request(original.url.replace(origin, edgeHost), {headers: original.headers});
      const result = await worker.fetch(req, edgeEnv());
      expect(await result.json()).toEqual({error:0,balance:250});
      expect(traceLog.mock.calls).toEqual([
        ['softaggregator.callback.edge', 'supplier_signature_format_accepted'],
        ['softaggregator.callback.edge', 'origin_http_200_json'],
      ]);
      expect(JSON.stringify(traceLog.mock.calls)).not.toContain('bv_');
      expect(JSON.stringify(traceLog.mock.calls)).not.toContain(salt);
      traceLog.mockClear();

      const invalidHeader = new Headers(original.headers);
      invalidHeader.set('x-signature', 'invalid');
      await worker.fetch(new Request(req.url, {headers:invalidHeader}), edgeEnv());
      expect(traceLog.mock.calls).toEqual([
        ['softaggregator.callback.edge', 'refused_supplier_signature_format'],
      ]);
      traceLog.mockClear();

      const wrongIpHeaders = new Headers(original.headers);
      wrongIpHeaders.set('cf-connecting-ip', '203.0.113.99');
      await worker.fetch(new Request(req.url, {headers:wrongIpHeaders}), edgeEnv());
      expect(traceLog).not.toHaveBeenCalled();
    } finally {
      traceLog.mockRestore();
    }
  });

  it('rejects tampering of amount, player and rollback after trusted ingress', async () => {
    await worker.fetch(callback(), edgeEnv());
    const signed = forwarded.headers.get('x-betvima-edge-signature');
    for (const [key, value] of [['amount', '900'], ['username', 'bv_00000000000000000000000000000001'], ['rb', '1']]) {
      const changed = new URL(forwarded.url);
      changed.searchParams.set(key, value);
      expect(validateCallback(changed, signed, salt, now, edgeSecret)).toBeNull();
      expect(verifySupplierCallbackSignature(changed, forwarded.headers.get('x-signature'), salt)).toBe(false);
    }
    expect(validateCallback(new URL(forwarded.url), 'f'.repeat(64), salt, now, edgeSecret)).toBeNull();
  });

  it('blocks unknown IPs, unset IP allowlist, or missing independent secret', async () => {
    for (const [req, env] of [
      [callback({}, '203.0.113.99'), edgeEnv()],
      [callback(), edgeEnv({SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS: ''})],
      [callback(), edgeEnv({SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS: '*'})],
      [callback(), edgeEnv({SOFTAGGREGATOR_EDGE_HMAC_SECRET: ''})],
      [callback({}, allowedIP, 'invalid-provider-hmac'), edgeEnv()],
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
    expect(validateCallback(new URL(forwarded.url), forwarded.headers.get('x-betvima-edge-signature'),
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
