import { describe, expect, it } from 'vitest';
import { identifyBet365SettlementCandidate, identifyBet365SelectionCandidate, canPublishBet365CatalogueToWagering } from './betsapi-bet365-catalogue';

describe('Bet365 strict diagnostic mappings', () => {
  it('recognizes exact odd-even market and outcomes only', () => {
    expect(identifyBet365SettlementCandidate('Goals Odd/Even')).toBe('GOALS_ODD_EVEN');
    expect(identifyBet365SelectionCandidate('GOALS_ODD_EVEN', 'Odd', null)).toBe('ODD');
    expect(identifyBet365SelectionCandidate('GOALS_ODD_EVEN', 'Even', null)).toBe('EVEN');
    expect(identifyBet365SelectionCandidate('GOALS_ODD_EVEN', 'Team Odd', null)).toBeNull();
  });
  it('does not guess last scorer sides', () => {
    expect(identifyBet365SettlementCandidate('Last Team to Score')).toBe('LAST_TEAM_TO_SCORE');
    expect(identifyBet365SelectionCandidate('LAST_TEAM_TO_SCORE', 'Home', null)).toBe('HOME');
    expect(identifyBet365SelectionCandidate('LAST_TEAM_TO_SCORE', 'Away', null)).toBe('AWAY');
    expect(identifyBet365SelectionCandidate('LAST_TEAM_TO_SCORE', 'Team A', null)).toBeNull();
  });
  it('cannot authorize wagers even with mapped diagnostic outcomes', () => {
    expect(canPublishBet365CatalogueToWagering()).toBe(false);
  });
});
