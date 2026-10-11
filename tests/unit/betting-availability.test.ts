import { afterEach, describe, expect, it, vi } from 'vitest';
import { BettingService, type QuoteInput } from '@/server/services/betting-service';
import type { Services } from '@/server/services/container';
import type { SelectionSnapshot } from '@/lib/ports/repositories';

vi.mock('@/server/utils/hash', () => ({ signQuote: () => 'isolated-mock-quote', verifyQuote: vi.fn() }));

const snapshot = (overrides: Partial<SelectionSnapshot> = {}): SelectionSnapshot => ({
  selectionId: 'selection-test', marketId: 'market-test', matchId: 'match-test',
  matchLabel: 'Test Home - Test Away', marketKey: 'h2h', marketName: 'Winner', selectionName: 'Home',
  marketStatus: 'open', selectionStatus: 'open', matchStatus: 'scheduled',
  isLive: false, scheduledAt: '2026-10-12T19:00:00Z',
  oddsUpdatedAt: new Date().toISOString(), oddsScaled: 20_000n, oddsVersion: 7,
  line: null, maxStakeMinor: null, ...overrides,
});

function fixture(overrides: Partial<SelectionSnapshot> = {}, enabled = true) {
  const placeBet = vi.fn();
  const row = snapshot(overrides);
  const service = new BettingService({
    catalog: { getSelectionsForPlacement: vi.fn().mockResolvedValue([row]) },
    admin: { operations: vi.fn().mockResolvedValue(enabled ? [{ key: 'LIVE_BETTING', isEnabled: true }] : []) },
    db: { queryOne: vi.fn().mockResolvedValue(null) },
    betting: { placeBet },
  } as unknown as Services);
  const input: QuoteInput = { actor: { userId: 'test-user', role: 'authenticated' }, userId: 'test-user', currency: 'IRT',
    slip: { type: 'SINGLE', currency: 'IRT', stakeMinor: 10_000n,
      legs: [{ selectionId: row.selectionId, marketId: row.marketId, matchId: row.matchId, clientOddsScaled: 20_000n, marketVersion: 7, acceptOddsChange: false }] } };
  return { service, input, placeBet };
}

describe('isolated Live and Prematch quote availability', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ['Live', true, 30], ['Prematch', false, 240],
  ] as const)('prices fresh %s quotes without placing a bet', async (_label, isLive, age) => {
    const { service, input, placeBet } = fixture({ isLive, matchStatus: isLive ? 'live' : 'scheduled', oddsUpdatedAt: new Date(Date.now() - age * 1000).toISOString() });
    const quote = await service.quote(input);
    expect(quote.combinedOddsScaled).toBe(20_000n);
    expect(quote.potentialPayoutMinor).toBe(20_000n);
    expect(placeBet).not.toHaveBeenCalled();
  });

  it.each([
    ['stale Live', { isLive: true, oddsUpdatedAt: new Date(Date.now() - 46_000).toISOString() }, 'STALE_ODDS'],
    ['stale Prematch', { oddsUpdatedAt: new Date(Date.now() - 301_000).toISOString() }, 'STALE_ODDS'],
    ['suspended market', { marketStatus: 'suspended' }, 'MARKET_SUSPENDED'],
    ['suspended selection', { selectionStatus: 'suspended' }, 'MARKET_SUSPENDED'],
    ['manual review market', { marketStatus: 'manual_review' }, 'MARKET_SUSPENDED'],
    ['invalid timestamp', { oddsUpdatedAt: 'invalid-date' }, 'STALE_ODDS'],
    ['missing timestamp', { oddsUpdatedAt: null }, 'STALE_ODDS'],
    ['changed price', { oddsScaled: 21_000n }, 'ODDS_CHANGED'],
  ] as const)('refuses %s before any placement', async (_label, overrides, code) => {
    const { service, input, placeBet } = fixture(overrides);
    await expect(service.quote(input)).rejects.toMatchObject({ code });
    expect(placeBet).not.toHaveBeenCalled();
  });

  it('fails closed when the live operation is missing', async () => {
    const { service, input, placeBet } = fixture({ isLive: true, matchStatus: 'live' }, false);
    await expect(service.quote(input)).rejects.toMatchObject({ code: 'LIVE_BETTING_DISABLED' });
    expect(placeBet).not.toHaveBeenCalled();
  });
});
