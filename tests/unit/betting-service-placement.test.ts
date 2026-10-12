import { describe, expect, it, vi } from 'vitest';
import { BettingService, type QuoteInput } from '@/server/services/betting-service';
import type { Services } from '@/server/services/container';

function makeScenario() {
  const snapshot = {
    selectionId: '11111111-1111-4111-8111-111111111111',
    marketId: '22222222-2222-4222-8222-222222222222',
    matchId: '33333333-3333-4333-8333-333333333333',
    marketKey: 'h2h', marketName: 'Match Winner',
    matchLabel: 'Home - Away', selectionName: 'Home',
    matchStatus: 'scheduled', marketStatus: 'open', selectionStatus: 'open',
    isLive: false, scheduledAt: new Date(Date.now()+3600000).toISOString(),
    oddsUpdatedAt: new Date().toISOString(), oddsScaled: 25000n, oddsVersion: 1,
  };
  const getSelectionsForPlacement = vi.fn(async () => [snapshot]);
  const placeBet = vi.fn(async () => ({ status: 'accepted', bet: {}, balanceAfterMinor: 9900n, quote: {} }));
  const deps = {
    catalog: { getSelectionsForPlacement },
    betting: { placeBet },
    db: { queryOne: vi.fn(async () => null) },
    admin: { operations: vi.fn(async () => []) },
  } as unknown as Services;
  const input: QuoteInput = {
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    actor: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } as QuoteInput['actor'],
    currency: 'USD',
    slip: {
      type: 'SINGLE',
      stakeMinor: 100n,
      currency: 'USD',
      fundingSource: 'main',
      legs: [{
        selectionId: snapshot.selectionId,
        matchId: snapshot.matchId,
        marketId: snapshot.marketId,
        clientOddsScaled: 25000n,
        marketVersion: 1,
        acceptOddsChange: false,
      }],
    },
  };
  return { snapshot, service: new BettingService(deps), placeBet, input };
}

describe('real-money bet placement preconditions', () => {
  it('uses the explicit signed quote, and fails closed on another unaccepted market move', async () => {
    const { service, input, snapshot, placeBet } = makeScenario();
    const quote = await service.quote(input);
    expect(quote.quoteToken).toContain('.');
    snapshot.oddsVersion = 2;
    snapshot.oddsScaled = 27000n;
    await expect(service.place({
      ...input, idempotencyKey: 'retry-same-intent-1', quoteToken: quote.quoteToken,
    })).rejects.toMatchObject({ code: 'ODDS_CHANGED' });
    expect(placeBet).not.toHaveBeenCalled();
  });

  it('sends accepted quote price with DB odds-change acceptance disabled', async () => {
    const { service, input, placeBet } = makeScenario();
    const quote = await service.quote(input);
    await service.place({
      ...input, idempotencyKey: 'retry-same-intent-2', quoteToken: quote.quoteToken,
    });
    expect(placeBet).toHaveBeenCalledTimes(1);
    const submitted = placeBet.mock.calls[0]?.[0] as any;
    expect(submitted.idempotencyKey).toBe('retry-same-intent-2');
    expect(submitted.payload.legs).toMatchObject([{
      clientOddsScaled: '25000',
      marketVersion: 1,
      acceptOddsChange: false,
    }]);
  });

  it('does not attempt a debit for suspended selections or stale pricing', async () => {
    const { service, input, snapshot, placeBet } = makeScenario();
    snapshot.selectionStatus = 'suspended';
    await expect(service.quote(input)).rejects.toMatchObject({ code: 'MARKET_SUSPENDED' });
    snapshot.selectionStatus = 'open';
    snapshot.oddsUpdatedAt = new Date(Date.now() - 600000).toISOString();
    await expect(service.place({ ...input, idempotencyKey: 'retry-blocked-3' }))
      .rejects.toMatchObject({ code: 'STALE_ODDS' });
    expect(placeBet).not.toHaveBeenCalled();
  });

  it('rejects a signed quote copied from another bet amount without debiting', async () => {
    const { service, input, placeBet } = makeScenario();
    const quote = await service.quote(input);
    await expect(service.place({
      ...input,
      slip: { ...input.slip, stakeMinor: 200n },
      idempotencyKey: 'retry-tampered-4',
      quoteToken: quote.quoteToken,
    })).rejects.toMatchObject({ code: 'ODDS_EXPIRED' });
    expect(placeBet).not.toHaveBeenCalled();
  });
});
