import { describe, expect, it } from 'vitest';
import { parseBet365Catalogue, canPublishBet365CatalogueToWagering, identifyBet365SettlementCandidate } from '@/providers/betsapi-bet365-catalogue';

describe('Bet365 catalogue read-only mapping', () => {
  it('identifies only explicitly matched market titles without authorizing wagers', () => {
    expect(identifyBet365SettlementCandidate('Fulltime Result')).toBe('1X2');
    expect(identifyBet365SettlementCandidate('Asian Handicap')).toBe('ASIAN_HANDICAP');
    expect(identifyBet365SettlementCandidate('Alternative Asian Handicap')).toBeNull();
    expect(identifyBet365SettlementCandidate('1st Half Asian Handicap')).toBeNull();
    expect(identifyBet365SettlementCandidate('4th Goal')).toBeNull();
    expect(canPublishBet365CatalogueToWagering()).toBe(false);
  });

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
  it('keeps suspended markets and individual unavailable picks visible but non-executable', () => {
    const result = parseBet365Catalogue('999', 'live', [[
      { type: 'MG', ID: '15', NA: 'Goals', SU: '1' },
      { type: 'MA', NA: '2.5', SU: '0' },
      { type: 'PA', ID: '10', NA: 'Over', HA: '2.5', OD: '5/4', SU: '0' },
      { type: 'MG', ID: '16', NA: 'Match result', SU: '0' },
      { type: 'PA', ID: '11', NA: 'Home', OD: '2/1', SU: '1' },
    ]]);
    expect(result.marketCount).toBe(2);
    expect(result.markets[0]?.status).toBe('suspended');
    expect(result.markets[0]?.selections[0]).toMatchObject({status: 'suspended',line:'2.5'});
    expect(result.markets[1]?.status).toBe('open');
    expect(result.markets[1]?.selections[0]?.status).toBe('suspended');
  });
  it('rejects invalid bookmaker FI and prohibits wagering publication', () => {
    expect(() => parseBet365Catalogue('../x', 'live', [])).toThrow('INVALID_BET365_FI');
    expect(canPublishBet365CatalogueToWagering()).toBe(false);
  });
});
