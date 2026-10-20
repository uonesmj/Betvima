import { beforeEach, describe, expect, it } from 'vitest';
import { canonicalBetsApiMarketForEvent, type CanonicalBetsApiMarket } from '@/lib/betsapi-canonical-card-odds';
import { useBetSlip, type SlipItem } from '@/lib/store/betslip';

const base: CanonicalBetsApiMarket = {
  providerId: '1:13326696',
  matchId: 'local-match-uuid',
  marketId: 'local-market-uuid',
  home: 'Home',
  away: 'Away',
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
  selections: [
    { code: 'HOME', selectionId: 'sel-home', oddsScaled: '22500', oddsVersion: 2 },
    { code: 'DRAW', selectionId: 'sel-draw', oddsScaled: '34000', oddsVersion: 1 },
    { code: 'AWAY', selectionId: 'sel-away', oddsScaled: '31000', oddsVersion: 3 },
  ],
};

describe('BetsAPI card-to-bet-slip canonical identity', () => {
  it('identifies the exact Events API ID (not an unrelated Bet365 FI)', () => {
    expect(canonicalBetsApiMarketForEvent('13326696', [base])).toBe(base);
    expect(canonicalBetsApiMarketForEvent('13326697', [base])).toBeNull();
    expect(canonicalBetsApiMarketForEvent(null, [base])).toBeNull();
    expect(canonicalBetsApiMarketForEvent('13326696-unsafe', [base])).toBeNull();
  });

  it('never offers expired or incompletely priced matches', () => {
    const now = Date.now();
    expect(canonicalBetsApiMarketForEvent('13326696', [{
      ...base, expiresAt: new Date(now - 1000).toISOString(),
    }], now)).toBeNull();
    expect(canonicalBetsApiMarketForEvent('13326696', [{
      ...base, selections: base.selections.filter(x => x.code !== 'DRAW'),
    }], now)).toBeNull();
    expect(canonicalBetsApiMarketForEvent('13326696', [{
      ...base, selections: base.selections.map(x => ({ ...x, oddsVersion: 0 })),
    }], now)).toBeNull();
  });
});

describe('betslip selection clicks', () => {
  const item: SlipItem = {
    selectionId: 'sel-home', marketId: 'mk1', matchId: 'm1',
    oddsScaled: '22500', oddsVersionSeen: 2,
    label: 'Home', marketLabel: '1X2', matchLabel: 'Home - Away',
    sportSlug: 'football', addedAt: 100,
  };

  beforeEach(() => {
    useBetSlip.setState({ items: [], isOpen: false, userClosed: false,
      lastError: null, lastSuccess: null });
  });

  it('opens the mobile sheet when a new canonical outcome is clicked', () => {
    expect(useBetSlip.getState().toggle(item).action).toBe('ADDED');
    expect(useBetSlip.getState().isOpen).toBe(true);
    expect(useBetSlip.getState().items[0]?.selectionId).toBe('sel-home');
  });

  it('reopens the dismissed mobile sheet when changing the same market', () => {
    useBetSlip.getState().toggle(item);
    useBetSlip.getState().close();
    expect(useBetSlip.getState().isOpen).toBe(false);
    const newer = { ...item, selectionId: 'sel-draw', label: 'Draw' };
    expect(useBetSlip.getState().toggle(newer).action).toBe('REPLACED');
    expect(useBetSlip.getState().isOpen).toBe(true);
    expect(useBetSlip.getState().userClosed).toBe(false);
    expect(useBetSlip.getState().items.map(x => x.selectionId)).toEqual(['sel-draw']);
  });
});
