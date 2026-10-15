import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  validateCallback, playerUsername, userIdFromUsername, playerPassword,
} from '@/server/providers/softaggregator/contract';

const salt = 'testing-provider-salt-value-32-chars-long';
const now = 1_800_000_000_000;
const userId = '7aa50699-cba1-4767-b7b4-dcd644399816';
const username = playerUsername(userId);

function signed(params: Record<string, string>, timestamp = String(now / 1000)) {
  const values = new URLSearchParams({
    ...params,
    timestamp,
    key: createHash('md5').update(timestamp + salt).digest('hex'),
  });
  const canonical = [...values.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, value]) => name + '=' + value).join('&');
  const hmac = createHmac('sha256', salt).update(canonical).digest('hex');
  return { url: new URL('https://betvima.com/api/webhooks/softaggregator?' + values.toString()), hmac };
}

describe('SoftAggregator full-payload callback authentication', () => {
  it('maps an internal user to a deterministic, reversible provider identifier', () => {
    expect(userIdFromUsername(username)).toBe(userId);
    expect(userIdFromUsername('admin')).toBeNull();
    expect(playerPassword(userId, 'x'.repeat(32))).toHaveLength(64);
    expect(playerPassword(userId, 'x'.repeat(32))).not.toBe(playerPassword(userId, 'y'.repeat(32)));
  });
  it('accepts correctly authenticated balance and debit callbacks in integer USD cents', () => {
    const b = signed({ action: 'balance', username, currency: 'USD' });
    expect(validateCallback(b.url, b.hmac, salt, now)?.action).toBe('balance');
    const d = signed({
      action: 'debit', username, currency: 'USD',
      call_id: 'c001', amount: '250', round_id: 'r1', game_id: 'p/game', rb: '0',
    });
    const event = validateCallback(d.url, d.hmac, salt, now);
    expect(event?.amountMinor).toBe(250n);
    expect(event?.identityHash).toHaveLength(64);
    expect(event?.callId).toBe('c001');
  });
  it('rejects a missing or altered HMAC even when the legacy MD5 key is valid', () => {
    const d = signed({ action: 'credit', username, currency: 'USD', call_id: 'x2', amount: '200' });
    expect(validateCallback(d.url, null, salt, now)).toBeNull();
    d.url.searchParams.set('amount', '2000');
    expect(validateCallback(d.url, d.hmac, salt, now)).toBeNull();
  });
  it('rejects stale timestamps, duplicated fields, unsupported currencies and invalid amounts', () => {
    const base = { action: 'debit', username, currency: 'USD', call_id: 'x1', amount: '200' };
    const old = signed(base, String(now / 1000 - 31));
    expect(validateCallback(old.url, old.hmac, salt, now)).toBeNull();
    const duplicate = signed(base);
    duplicate.url.searchParams.append('amount', '500');
    expect(validateCallback(duplicate.url, duplicate.hmac, salt, now)).toBeNull();
    const badCurrency = signed({ ...base, currency: 'IRT' });
    expect(validateCallback(badCurrency.url, badCurrency.hmac, salt, now)).toBeNull();
    for (const amount of ['0', '-1', '1.50', '999999999999999']) {
      const bad = signed({ ...base, amount });
      expect(validateCallback(bad.url, bad.hmac, salt, now)).toBeNull();
    }
  });
  it('preserves distinct transaction identities for free-spin credits and rollback callbacks', () => {
    const a = signed({ action: 'credit', username, currency: 'USD', call_id: 'win1', amount: '75', rb: '0' });
    const b = signed({ action: 'credit', username, currency: 'USD', call_id: 'win1', amount: '75', rb: '1' });
    const x = validateCallback(a.url, a.hmac, salt, now)!;
    const y = validateCallback(b.url, b.hmac, salt, now)!;
    expect(x.action).toBe('credit');
    expect(y.rollback).toBe(true);
    expect(x.identityHash).not.toBe(y.identityHash);
  });
});
