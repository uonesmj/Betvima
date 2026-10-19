import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casinoRealMoneyEnabled } from '@/server/providers/softaggregator/client';
import { settleCasinoCallback } from '@/server/providers/softaggregator/wallet';
import { GET } from '@/app/api/webhooks/softaggregator/route';

vi.mock('@/server/providers/softaggregator/client', () => ({
  casinoRealMoneyEnabled: vi.fn(),
}));
vi.mock('@/server/providers/softaggregator/wallet', () => ({
  settleCasinoCallback: vi.fn(),
}));

const SALT = 'cash-staging-provider-salt-never-real-0123456';
// Simulated trusted edge signs the canonical full query independently of provider MD5.
const EDGE_SECRET = 'test-independent-edge-hmac-secret-40-plus-chars';
const USERNAME = 'bv_7aa50699cba14767b7b4dcd644399816';

function signedCallback(params: Record<string, string>, mutateSignature = false): Request {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const fields = new URLSearchParams({
    username: USERNAME, currency: 'USD', timestamp,
    key: createHash('md5').update(timestamp + SALT).digest('hex'),
    ...params,
  });
  const canonical = new URLSearchParams([...fields.entries()]
    .sort(([nameA], [nameB]) => nameA < nameB ? -1 : nameA > nameB ? 1 : 0)).toString();
  const edgeSignature = createHmac('sha256', EDGE_SECRET).update(canonical).digest('hex');
  const vendorCanonical = [...fields.entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, value]) => name + '=' + value).join('&');
  const supplierSignature = createHmac('sha256', SALT).update(vendorCanonical).digest('hex');
  return new Request('https://betvima.com/api/webhooks/softaggregator?' + fields.toString(), {
    method: 'GET', headers: {
      'x-signature': mutateSignature ? '0'.repeat(64) : supplierSignature,
      'x-betvima-edge-signature': edgeSignature,
    },
  });
}

describe('SoftAggregator signed HTTP wallet webhook — no actual funds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('SOFTAGGREGATOR_SALT_KEY', SALT);
    vi.stubEnv('SOFTAGGREGATOR_EDGE_HMAC_SECRET', EDGE_SECRET);
    vi.mocked(casinoRealMoneyEnabled).mockReturnValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('rejects every money callback if the real-money feature flag is disabled', async () => {
    vi.mocked(casinoRealMoneyEnabled).mockReturnValue(false);
    const request = signedCallback({
      action: 'debit', call_id: 'refused-flag', amount: '250',
      round_id: 'round-1', game_id: 'provider/game',
    });
    const response = await GET(request);
    expect(response.status).toBe(200); // Supplier business protocol.
    expect(await response.json()).toEqual({ error: 2, balance: 0 });
    expect(settleCasinoCallback).not.toHaveBeenCalled();
  });

  it('rejects a valid timestamp with altered full-payload HMAC', async () => {
    const request = signedCallback({
      action: 'credit', call_id: 'tampered-win', amount: '400',
      round_id: 'round-1', game_id: 'provider/game',
    }, true);
    const response = await GET(request);
    expect(await response.json()).toEqual({ error: 2, balance: 0 });
    expect(settleCasinoCallback).not.toHaveBeenCalled();
  });

  it('rejects missing native provider signature even with a valid edge HMAC', async () => {
    const req = signedCallback({
      action: 'debit', call_id: 'no-provider-proof', amount: '250',
      round_id: 'round-1', game_id: 'provider/game',
    });
    const headers = new Headers(req.headers);
    headers.delete('x-signature');
    const response = await GET(new Request(req, { headers }));
    expect(await response.json()).toEqual({ error: 2, balance: 0 });
    expect(settleCasinoCallback).not.toHaveBeenCalled();
  });

  it('rejects an invalid edge signature even when the supplier HMAC is valid', async () => {
    const req = signedCallback({
      action: 'debit', call_id: 'no-edge-proof', amount: '250',
      round_id: 'round-1', game_id: 'provider/game',
    });
    const headers = new Headers(req.headers);
    headers.set('x-betvima-edge-signature', '0'.repeat(64));
    const response = await GET(new Request(req, { headers }));
    expect(await response.json()).toEqual({ error: 2, balance: 0 });
    expect(settleCasinoCallback).not.toHaveBeenCalled();
  });

  it('accepts a signed debit and returns the exact committed USD cents', async () => {
    vi.mocked(settleCasinoCallback).mockResolvedValue({ error: 0, balance: 9750 });
    const response = await GET(signedCallback({
      action: 'debit', call_id: 'paid-bet-1', amount: '250',
      round_id: 'round-1', game_id: 'provider/game', rb: '0', type: 'bet',
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 0, balance: 9750 });
    expect(settleCasinoCallback).toHaveBeenCalledOnce();
    const event = vi.mocked(settleCasinoCallback).mock.calls[0]?.[0];
    expect(event).toMatchObject({
      action: 'debit', username: USERNAME,
      amountMinor: 250n, callId: 'paid-bet-1',
      roundId: 'round-1', gameId: 'provider/game', rollback: false,
    });
  });

  it('accepts a signed credit without a prior debit (free-spin winnings)', async () => {
    vi.mocked(settleCasinoCallback).mockResolvedValue({ error: 0, balance: 500 });
    const response = await GET(signedCallback({
      action: 'credit', call_id: 'free-spin-win', amount: '500',
      round_id: 'free-round', game_id: 'provider/game', type: 'bonus_fs',
    }));
    expect(await response.json()).toEqual({ error: 0, balance: 500 });
    expect(vi.mocked(settleCasinoCallback).mock.calls[0]?.[0].action).toBe('credit');
  });

  it('answers processing error without reporting settlement success when the database fails', async () => {
    vi.mocked(settleCasinoCallback).mockRejectedValue(new Error('DB_DOWN'));
    const request = signedCallback({
      action: 'debit', call_id: 'db-down', amount: '100',
      round_id: 'round-2', game_id: 'provider/game',
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ error: 2, balance: 0 });
  });
});
