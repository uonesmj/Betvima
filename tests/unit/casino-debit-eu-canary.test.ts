import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyDebitEuCanary } from '../../supabase/functions/betvima-debit-eu-canary/verify';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const key = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const now = 1793360000000;
const nonce = '0123456789abcdef0123456789abcdef';
function signed(p: Record<string, unknown> = { v: 1, ts: now, nonce, kind: 'debit_eu_canary' }) {
  const body = new TextEncoder().encode(JSON.stringify(p));
  return { body, signature: sign(null, body, privateKey).toString('base64') };
}

describe('Ireland Debit edge non-financial canary', () => {
  it('accepts a signed, short-lived synthetic canary only in Ireland', async () => {
    const { body, signature } = signed();
    expect(await verifyDebitEuCanary(body, signature, key, 'eu-west-1', now))
      .toEqual({ ok: true, code: 'CANARY_AUTHENTICATED' });
  });
  it('rejects unsigned, altered, and incorrectly signed requests', async () => {
    const { body, signature } = signed();
    expect((await verifyDebitEuCanary(body, '', key, 'eu-west-1', now)).ok).toBe(false);
    expect(await verifyDebitEuCanary(
      new TextEncoder().encode(JSON.stringify({ v: 1, ts: now, nonce, kind: 'debit' })),
      signature, key, 'eu-west-1', now,
    )).toEqual({ ok: false, code: 'INVALID_SIGNATURE' });
    expect((await verifyDebitEuCanary(body, signature, '', 'eu-west-1', now)).ok).toBe(false);
  });
  it('rejects financial actions and every user/amount field even if signed', async () => {
    for (const payload of [
      { v: 1, ts: now, nonce, kind: 'debit' },
      { v: 1, ts: now, nonce, kind: 'credit' },
      { v: 1, ts: now, nonce, kind: 'rollback' },
      { v: 1, ts: now, nonce, kind: 'debit_eu_canary', amount: 10 },
      { v: 1, ts: now, nonce, kind: 'debit_eu_canary', username: 'anything' },
      { v: 1, ts: now, nonce, kind: 'debit_eu_canary', call_id: 'anything' },
      { v: 1, ts: now, nonce, kind: 'debit_eu_canary', player_id: 'anything' },
    ]) {
      const { body, signature } = signed(payload);
      expect((await verifyDebitEuCanary(body, signature, key, 'eu-west-1', now)).ok).toBe(false);
    }
  });
  it('rejects expired, future, out-of-region, and oversize bodies', async () => {
    for (const ts of [now - 30001, now + 30001]) {
      const { body, signature } = signed({ v: 1, ts, nonce, kind: 'debit_eu_canary' });
      expect((await verifyDebitEuCanary(body, signature, key, 'eu-west-1', now)).ok).toBe(false);
    }
    const { body, signature } = signed();
    expect(await verifyDebitEuCanary(body, signature, key, 'us-east-1', now))
      .toEqual({ ok: false, code: 'UNEXPECTED_REGION' });
    expect((await verifyDebitEuCanary(new Uint8Array(513), signature, key, 'eu-west-1', now)).ok)
      .toBe(false);
  });
  it('has no SQL mutations and only fixed SELECT reads against synthetic identities', () => {
    const code = readFileSync(
      resolve('supabase/functions/betvima-debit-eu-canary/index.ts'), 'utf8',
    );
    expect(code).toContain('financial_operations_enabled: false');
    expect(code).toContain('wallet_modified: false');
    expect(code).toContain('sql_write_statements: 0');
    expect(code).toContain("req.method !== 'POST'");
    expect(code).toContain("Deno.env.get('SUPABASE_DB_URL')");
    expect(code.indexOf('await verifyDebitEuCanary')).toBeLessThan(
      code.indexOf('await sql`SELECT'),
    );
    const statements = [...code.matchAll(/await sql`([^\`]+)`/g)]
      .map(match => match[1] ?? '');
    expect(statements).toHaveLength(8);
    for (const statement of statements) {
      expect(statement.trim()).toMatch(/^SELECT /);
      expect(statement).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|CALL|TRUNCATE|ALTER|DROP)\b/i);
    }
    expect(code).toContain("const DUMMY_UUID = '00000000-0000-0000-0000-000000000000'");
    expect(code).not.toContain('post_wallet_entry');
    expect(code).not.toContain('p_amount_minor');
  });
});
