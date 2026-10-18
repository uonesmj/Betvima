import { describe, expect, it } from 'vitest';
import { parseBet365Catalogue, canPublishBet365CatalogueToWagering } from '@/providers/betsapi-bet365-catalogue';

describe('Bet365 catalogue read-only mapping', () => {
  it('keeps FI-scoped selection identity for prematch groups', () => {
    const result = parseBet365Catalogue('12345', 'upcoming', [{
      main: { sp: { winner: { id: '10', name: 'Full Time Result',
        odds: [{ id: '1', name: 'Home', odds: '2.25' },
          { id: '2', name: 'Away', odds: '3.10' }] } } },
    }]);
    expect(result.readOnly).toBe(true);
    expect(result.marketCount).toBe(1);
    expect(result.selectionCount).toBe(2);
    expect(result.markets[0]?.selections[0]?.id).toContain('bet365:12345:');
  });
  it('rejects invalid bookmaker FI and prohibits wagering publication', () => {
    expect(() => parseBet365Catalogue('../x', 'live', [])).toThrow('INVALID_BET365_FI');
    expect(canPublishBet365CatalogueToWagering()).toBe(false);
  });
});
