import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SOFTAGGREGATOR_CURRENCY = 'USD';
export const CALLBACK_TOLERANCE_MS = 30_000;
export const MAX_CALLBACK_AMOUNT_MINOR = 1_000_000_000_000n;

export type CallbackAction = 'balance' | 'debit' | 'credit';
export type SignedCallback = {
  action: CallbackAction;
  username: string;
  currency: 'USD';
  callId: string | null;
  amountMinor: bigint | null;
  roundId: string | null;
  gameId: string | null;
  rollback: boolean;
  identityHash: string | null;
};

function equalHex(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]+$/i.test(actual) || actual.length !== expected.length) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(actual, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function playerUsername(userId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('INVALID_PLAYER_ID');
  }
  return 'bv_' + userId.toLowerCase().replace(/-/g, '');
}

export function userIdFromUsername(username: string): string | null {
  const m = /^bv_([0-9a-f]{32})$/.exec(username);
  if (!m) return null;
  const id = m[1];
  return id.slice(0, 8) + '-' + id.slice(8, 12) + '-' + id.slice(12, 16) + '-' + id.slice(16, 20) + '-' + id.slice(20);
}

export function playerPassword(userId: string, secret: string): string {
  if (secret.length < 32) throw new Error('PLAYER_SECRET_TOO_SHORT');
  return createHmac('sha256', secret).update('softaggregator-player:' + userId).digest('hex');
}

export function validateCallback(url: URL, signature: string | null, salt: string, now = Date.now()): SignedCallback | null {
  if (!salt || salt.length < 12) return null;
  const params = url.searchParams;
  const names = [...params.keys()];
  if (names.length !== new Set(names).size) return null;
  if (names.length > 24) return null;
  const timestamp = params.get('timestamp') ?? '';
  const key = params.get('key') ?? '';
  if (!/^\d{10,13}$/.test(timestamp)) return null;
  const epoch = Number(timestamp) * (timestamp.length === 10 ? 1_000 : 1);
  if (!Number.isSafeInteger(epoch) || Math.abs(now - epoch) > CALLBACK_TOLERANCE_MS) return null;
  const md5 = createHash('md5').update(timestamp + salt).digest('hex');
  if (!equalHex(md5, key)) return null;
  // Full-payload HMAC is mandatory; MD5(timestamp + salt) alone does NOT authenticate the amount.
  if (!signature) return null;
  const canonical = [...params.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([name, value]) => name + '=' + value).join('&');
  const expected = createHmac('sha256', salt).update(canonical).digest('hex');
  if (!equalHex(expected, signature.trim())) return null;

  const action = params.get('action');
  const username = params.get('username') ?? '';
  if (action !== 'balance' && action !== 'debit' && action !== 'credit') return null;
  if (!userIdFromUsername(username) || params.get('currency') !== SOFTAGGREGATOR_CURRENCY) return null;
  if (action === 'balance') return {
    action, username, currency: 'USD', callId: null, amountMinor: null,
    roundId: null, gameId: null, rollback: false, identityHash: null,
  };

  const callId = params.get('call_id') ?? '';
  const amount = params.get('amount') ?? '';
  if (!/^[A-Za-z0-9_:./-]{1,160}$/.test(callId) || !/^[1-9]\d{0,14}$/.test(amount)) return null;
  const amountMinor = BigInt(amount);
  if (amountMinor > MAX_CALLBACK_AMOUNT_MINOR) return null;
  const roundId = params.get('round_id') ?? '';
  const gameId = params.get('game_id') ?? '';
  const rollback = params.get('rb') === '1';
  if ((params.has('rb') && params.get('rb') !== '0' && params.get('rb') !== '1') ||
      roundId.length > 240 || gameId.length > 240) return null;
  const identityHash = createHash('sha256').update(JSON.stringify({
    action, username, currency: 'USD', callId, amount, roundId, gameId, rollback,
  })).digest('hex');
  return {
    action, username, currency: 'USD', callId, amountMinor, roundId, gameId,
    rollback, identityHash,
  };
}

export function callbackResponse(error: 0 | 1 | 2, balanceMinor: bigint | number | string) {
  return { error, balance: Number(balanceMinor) };
}
