import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyBridgeShadowProbe } from '../../supabase/functions/betvima-casino-edge-shadow/verify';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const pubkeySpkiB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const encoder = new TextEncoder();
const nonce = '9fb72697c9e24c0a8b6d345647de10aa';
const now = 1793038000000;

const build = (payload: Record<string, unknown> = {
  v: 1, ts: now, nonce, kind: 'probe',
}) => {
  const body = encoder.encode(JSON.stringify(payload));
  return { body, sig: sign(null, body, privateKey).toString('base64') };
};

describe('BetVima independent Ed25519 Edge shadow transport', () => {
  it('accepts only an Ed25519-signed, on-time, synthetic EU-West probe', async () => {
    const { body, sig } = build();
    await expect(verifyBridgeShadowProbe(body, sig, pubkeySpkiB64, 'eu-west-1', now))
      .resolves.toEqual({ ok: true, code: 'PROBE_SIGNATURE_VERIFIED' });
  });

  it('fails closed when no independent pinned public key has been deployed', async () => {
    const { body, sig } = build();
    const result = await verifyBridgeShadowProbe(body, sig, '', 'eu-west-1', now);
    expect(result).toEqual({ ok: false, code: 'VERIFY_KEY_NOT_CONFIGURED' });
  });

  it('rejects tampered payloads even when the original signature is provided', async () => {
    const { body, sig } = build();
    const tampered = encoder.encode(
      new TextDecoder().decode(body).replace('"probe"', '"debit"'),
    );
    const result = await verifyBridgeShadowProbe(tampered, sig, pubkeySpkiB64, 'eu-west-1', now);
    expect(result).toEqual({ ok: false, code: 'INVALID_SIGNATURE' });
  });

  it('rejects expired and future timestamps', async () => {
    for (const ts of [now - 30_001, now + 30_001]) {
      const { body, sig } = build({ v: 1, ts, nonce, kind: 'probe' });
      const result = await verifyBridgeShadowProbe(body, sig, pubkeySpkiB64, 'eu-west-1', now);
      expect(result).toEqual({ ok: false, code: 'EXPIRED_PROBE' });
    }
  });

  it('rejects regions outside the Supabase database region', async () => {
    const { body, sig } = build();
    const result = await verifyBridgeShadowProbe(body, sig, pubkeySpkiB64, 'us-west-2', now);
    expect(result).toEqual({ ok: false, code: 'REGION_NOT_EU_WEST_1' });
  });

  it('rejects signed debit or credit even if the signer has the private key', async () => {
    for (const kind of ['debit', 'credit', 'rollback', 'balance']) {
      const { body, sig } = build({ v: 1, ts: now, nonce, kind });
      const result = await verifyBridgeShadowProbe(body, sig, pubkeySpkiB64, 'eu-west-1', now);
      expect(result).toEqual({ ok: false, code: 'INVALID_PROBE' });
    }
  });

  it('rejects signed financial fields, usernames and extra data', async () => {
    const { body, sig } = build({
      v: 1, ts: now, nonce, kind: 'probe', amountMinor: 10,
    });
    const result = await verifyBridgeShadowProbe(body, sig, pubkeySpkiB64, 'eu-west-1', now);
    expect(result).toEqual({ ok: false, code: 'SHADOW_PROBE_FIELDS_ONLY' });
  });

  it('rejects malformed signatures and noncanonical nonce values', async () => {
    const { body } = build();
    const sig = 'notvalid!!!';
    expect((await verifyBridgeShadowProbe(body, sig, pubkeySpkiB64, 'eu-west-1', now)).ok)
      .toBe(false);

    const badNonce = build({ v: 1, ts: now, nonce: 'abcd', kind: 'probe' });
    expect((await verifyBridgeShadowProbe(
      badNonce.body, badNonce.sig, pubkeySpkiB64, 'eu-west-1', now,
    )).ok).toBe(false);
  });

  it('does not include any wallet, casino ledger or database settlement code', () => {
    const source = readFileSync(resolve('supabase/functions/betvima-casino-edge-shadow/index.ts'), 'utf8');
    expect(source).toContain('MCowBQYDK2VwAyEAZ/H+1/rAxIccH4jY+wx7PE5wgFsotby7io0m6wx77cs=');
    expect(source).not.toContain("Deno.env.get('BV_CASINO_BRIDGE_ED25519_SPKI_B64')");
    expect(source).toContain("financial_operations_enabled: false");
    expect(source).toContain('wallet_modified: false');
    expect(source).toContain("request.method !== 'POST'");
    expect(source).toContain("Deno.env.get('SUPABASE_DB_URL')");
    expect([...source.matchAll(/await sql`([^`]+)`/g)].map(m => m[1])).toEqual(['SELECT 1::integer AS probe']);
    expect(source.indexOf('await verifyBridgeShadowProbe')).toBeLessThan(source.indexOf('await sql`'));
    expect(source).toContain('financial_operations_enabled: false');
    expect(source).not.toMatch(/(?:await sql`|query\()\s*(?:INSERT|UPDATE|DELETE|CALL|TRUNCATE)/i);
    expect(source).not.toContain('post_wallet_entry');
    expect(source).not.toContain('softaggregator_callback_receipts');
    expect(source).not.toContain('update nova.');
    expect(source).not.toContain('insert into nova.');
  });
});
