import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { inspectHistoricalSoftAggregatorCallback as inspect } from '../../scripts/lib/softaggregator-offline-verifier.mjs';

const salt = 'synthetic_vendor_private_salt_2026_abcdef';
const edgeSecret = 'synthetic-independent-worker-signing-secret-over-32-bytes';
const timestamp = '1792494809';
const nowMs = Number(timestamp) * 1000;
const goodUsername = 'bv_7aa50699cba14767b7b4dcd644399816';
const path = 'https://betvima-casino-callback.mimmim283228.workers.dev/api/webhooks/softaggregator';

function example(params = {}) {
  const q = new URLSearchParams({
    username: goodUsername, currency:'USD', action:'balance',
    call_id: 'synthetic_reference', timestamp,
    key: createHash('md5').update(timestamp + salt).digest('hex'),
    ...params,
  });
  const sorted = [...q.entries()].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
  return {
    url: path + '?' + q.toString(),
    xSignature: createHmac('sha256',salt)
      .update(sorted.map(([name,value])=>name+'='+value).join('&')).digest('hex'),
    edgeSignature: createHmac('sha256',edgeSecret)
      .update(new URLSearchParams(sorted).toString()).digest('hex'),
  };
}

describe('read-only historical SoftAggregator callback signature audit', () => {
  it('verifies supplier HMAC and legacy MD5 independently from timestamp freshness', () => {
    const input=example();
    const status=inspect({...input, salt, edgeSecret, nowMs:nowMs+3_600_000});
    expect(status).toMatchObject({
      readOnly:true, financialOperationsPerformed:false,
      requestShapeValid:true, supplierHmacValid:true,
      legacyTimestampMd5Valid:true, timestampWithinLiveWindow:false,
      betvimaUserFormatValid:true, edgeHmacValid:true,
      realMoneyApproved:false,
    });
    const live=inspect({...input,salt,edgeSecret,nowMs});
    expect(live.timestampWithinLiveWindow).toBe(true);
  });
  it('detects vendor signature tampering independently of valid MD5 and edge HMAC', () => {
    const input=example();
    expect(inspect({...input,xSignature:'0'.repeat(64),salt,edgeSecret,nowMs})
      .supplierHmacValid).toBe(false);
    const changed=new URL(input.url);
    changed.searchParams.set('call_id','altered');
    const status=inspect({...input,url:String(changed),salt,edgeSecret,nowMs});
    expect(status.legacyTimestampMd5Valid).toBe(true);
    expect(status.supplierHmacValid).toBe(false);
    expect(status.edgeHmacValid).toBe(false);
  });
  it('rejects duplicate keys and delimiter-collision values before signing', () => {
    const input=example();
    for (const url of [input.url+'&action=credit',
                       input.url+'&injected=ab%26other%3D1']) {
      const status=inspect({...input,url,salt,edgeSecret,nowMs});
      expect(status.requestShapeValid).toBe(false);
      expect(status.supplierHmacValid).toBe(false);
    }
  });
  it('does not claim that Cloudflare edge HMAC was verified without the actual edge header', () => {
    const input=example();
    const result=inspect({...input,edgeSignature:null,salt,edgeSecret,nowMs});
    expect(result.supplierHmacValid).toBe(true);
    expect(result.edgeHmacValid).toBeNull();
  });
  it('reports supplier-good but invalid non-BetVima test username distinctly', () => {
    const input=example({username:'softagg_test'});
    const url=new URL(input.url);
    const values=[...url.searchParams.entries()].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
    const xSignature=createHmac('sha256',salt)
      .update(values.map(([n,v])=>n+'='+v).join('&')).digest('hex');
    const result=inspect({url:input.url,xSignature,salt,nowMs});
    expect(result.supplierHmacValid).toBe(true);
    expect(result.legacyTimestampMd5Valid).toBe(true);
    expect(result.betvimaUserFormatValid).toBe(false);
    expect(result.edgeHmacValid).toBeNull();
  });
  it('fails closed for non-callback URL or absent salt', () => {
    const input=example();
    expect(inspect({...input,url:'https://example.net/api/webhooks/softaggregator',
      salt,nowMs}).requestShapeValid).toBe(false);
    expect(inspect({...input,salt:'',nowMs}).supplierHmacValid).toBe(false);
  });
});
