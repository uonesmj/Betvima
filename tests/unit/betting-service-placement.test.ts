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
  const placeBet = vi.fn(async (_input: unknown) => ({ status: 'accepted', bet: {}, balanceAfterMinor: 9900n, quote: {} }));
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


  it('preserves an accepted signed price when a no-change provider refresh only increments odds_version', async () => {
    const { service, input, snapshot, placeBet } = makeScenario();
    const quote = await service.quote(input);
    snapshot.oddsVersion = 12; // The bookmaker price remains exactly 2.50.
    await service.place({
      ...input,
      idempotencyKey: 'stable-quote-refresh',
      quoteToken: quote.quoteToken,
    });
    expect(placeBet).toHaveBeenCalledTimes(1);
    const submitted = placeBet.mock.calls[0]?.[0] as any;
    expect(submitted.payload.legs).toMatchObject([{
      clientOddsScaled: '25000',
      marketVersion: 12,
      acceptOddsChange: false,
    }]);
  });

  it('commits only the exact new price that the user explicitly approved', async () => {
    const { service, input, snapshot, placeBet } = makeScenario();
    snapshot.oddsScaled = 27000n;
    snapshot.oddsVersion = 2;
    const quote = await service.quote(input);
    expect(quote.oddsChanges).toMatchObject([{
      previousOddsScaled: 25000n,
      currentOddsScaled: 27000n,
    }]);
    snapshot.oddsVersion = 3; // Source refresh without a second price change.
    await service.place({
      ...input,
      idempotencyKey: 'approved-new-price',
      quoteToken: quote.quoteToken,
      acceptedOdds: { [snapshot.selectionId]: '27000' },
    });
    expect(placeBet).toHaveBeenCalledTimes(1);
    const submitted = placeBet.mock.calls[0]?.[0] as any;
    expect(submitted.payload.legs).toMatchObject([{
      clientOddsScaled: '27000',
      marketVersion: 3,
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
  it('blocks a stale scheduled fixture that has already kicked off', async () => {
    const { service, input, snapshot, placeBet } = makeScenario();
    snapshot.scheduledAt = new Date(Date.now() - 5000).toISOString();
    await expect(service.quote(input)).rejects.toMatchObject({ code: 'MATCH_FINISHED' });
    expect(placeBet).not.toHaveBeenCalled();
  });

  it('never prices a selection claimed under a different market ID', async () => {
    const { service, input, placeBet } = makeScenario();
    input.slip.legs[0]!.marketId = '44444444-4444-4444-8444-444444444444';
    await expect(service.quote(input)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(placeBet).not.toHaveBeenCalled();
  });

});
