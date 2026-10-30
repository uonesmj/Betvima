import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyOrdinaryDebitBridge } from '../../supabase/functions/betvima-debit-eu-canary/debit-bridge-contract';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicSpki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const now = 1793360000000;
const uid = '0123456789abcdef0123456789abcdef';
function base(overrides: Record<string, unknown> = {}) {
  const standard = {
    action: 'debit', username: 'bv_' + uid, currency: 'USD',
    callId: 'test-ordinary-debit-20261030', amount: '20',
    roundId: 'round-a', gameId: 'game-b', rollback: false,
  };
  const merged = { ...standard, ...overrides };
  const identity_hash = createHash('sha256')
    .update(JSON.stringify(merged)).digest('hex');
  return {
    v: 1, kind: 'softaggregator_debit', ts: now,
    nonce: '11223344556677889900aabbccddeeff',
    action: merged.action, username: merged.username,
    currency: merged.currency, call_id: merged.callId,
    amount: merged.amount, round_id: merged.roundId,
    game_id: merged.gameId, rollback: merged.rollback, identity_hash,
  };
}
function signed(payload: Record<string, unknown>) {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  return {
    raw,
    sig: sign(null, raw, privateKey).toString('base64'),
  };
}
async function check(p: Record<string, unknown>, region='eu-west-1', time=now) {
  const { raw, sig } = signed(p);
  return verifyOrdinaryDebitBridge(raw, sig, publicSpki, region, time);
}
describe('Inert signed ordinary USD Debit transport (not deployed)', () => {
  it('accepts a signed supplier-identity-equivalent ordinary Debit', async () => {
    const result = await check(base());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.amount).toBe('20');
      expect(result.payload.round_id).toBe('round-a');
    }
  });
  it('rejects unsigned, tampered body, altered identity hash', async () => {
    const p = base();
    const { raw, sig } = signed(p);
    expect((await verifyOrdinaryDebitBridge(raw, '', publicSpki, 'eu-west-1', now)).ok)
      .toBe(false);
    expect((await verifyOrdinaryDebitBridge(
      new TextEncoder().encode(JSON.stringify({ ...p, amount: '21' })),
      sig, publicSpki, 'eu-west-1', now,
    )).ok).toBe(false);
    expect((await check({ ...p, identity_hash: '0'.repeat(64) })).ok).toBe(false);
  });
  it('rejects Credit, Balance, Rollback and currency conversion', async () => {
    for (const patch of [
      { action:'credit' }, { action:'balance' }, { rollback:true },
      { currency:'IRT' }, { currency:'IRR' }, { currency:'EUR' },
      { kind:'reversal' },
    ]) expect((await check({ ...base(), ...patch })).ok).toBe(false);
  });
  it('rejects oversized, negative or noninteger values', async () => {
    for (const amount of ['0','-20','0.20','2000000000000','1e3','0001','']) {
      expect((await check(base({ amount }))).ok).toBe(false);
    }
    expect((await check(base({ callId:'' }))).ok).toBe(false);
    expect((await check(base({ roundId:'' }))).ok).toBe(false);
    expect((await check(base({ gameId:'' }))).ok).toBe(false);
  });
  it('rejects unknown fields, mismatched time and region', async () => {
    const p = base();
    expect((await check({ ...p, player_uuid:'other' })).ok).toBe(false);
    expect((await check(p, 'us-west-2')).ok).toBe(false);
    expect((await check(p, 'eu-west-1', now + 30001)).ok).toBe(false);
    expect((await check(p, 'eu-west-1', now - 30001)).ok).toBe(false);
  });
  it('rejects noncanonical signed JSON including duplicate keys', async () => {
    const p = base();
    const raw = new TextEncoder().encode(' ' + JSON.stringify(p));
    const sig = sign(null, raw, privateKey).toString('base64');
    expect((await verifyOrdinaryDebitBridge(raw,sig,publicSpki,'eu-west-1',now)).ok)
      .toBe(false);
    const duplicate = JSON.stringify(p).replace('"v":1,','"v":1,"v":1,');
    const bytes = new TextEncoder().encode(duplicate);
    const dupSig = sign(null,bytes,privateKey).toString('base64');
    expect((await verifyOrdinaryDebitBridge(bytes,dupSig,publicSpki,'eu-west-1',now)).ok)
      .toBe(false);
  });
});
