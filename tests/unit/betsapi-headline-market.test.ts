import { describe, expect, it } from 'vitest';
import { pickHeadlineMarket } from '@/lib/betsapi-headline-market';

describe('BetsAPI fixture card odds preview', () => {
  it('prefers authentic full-time results over goal and corner specials', () => {
    const result = pickHeadlineMarket([
      { key: 'corners', title: '2-Way Corners', selections: [
        { id: '1', label: 'Over 9.5', decimal: '1.8000' },
        { id: '2', label: 'Under 9.5', decimal: '2.0000' },
      ] },
      { key: '1x2', title: 'Fulltime Result', selections: [
        { id: '3', label: 'Home', decimal: '4.7500' },
        { id: '4', label: 'Draw', decimal: '1.2500' },
        { id: '5', label: 'Away', decimal: '15.0000' },
      ] },
    ]);
    expect(result?.key).toBe('1x2');
    expect(result?.selections).toHaveLength(3);
    expect(result?.selections[1]?.decimal).toBe('1.2500');
  });

  it('never shows unlabelled or invalid bookmaker outcomes in card previews', () => {
    expect(pickHeadlineMarket([{
      key: 'bad', title: 'Match Goals', selections: [
        { id: '11', label: 'Unlabelled outcome #112', decimal: '3.7500' },
        { id: '12', label: 'Real selection', decimal: '0' },
      ],
    }])).toBeNull();
  });

  it('keeps the valid selections only, with provider-supplied prices unchanged', () => {
    const picked = pickHeadlineMarket([{
      key: 'match', title: 'Match Winner',
      selections: [
        { id: '10', label: 'Team A', decimal: '1.5714' },
        { id: '11', label: 'Unlabelled outcome #11', decimal: '2.2000' },
        { id: '12', label: 'Team B', decimal: '2.2500' },
      ],
    }]);
    expect(picked?.selections.map(s => s.decimal)).toEqual(['1.5714', '2.2500']);
  });
  it('never substitutes next-goal, next-corner or scoreline specials for primary odds', () => {
    expect(pickHeadlineMarket([
      { key: 'only', title: '3rd Goal', selections: [
        { id: '101', label: 'Home FC', decimal: '3.0000' },
        { id: '102', label: 'Away FC', decimal: '2.5000' },
      ] },
      { key: 'score', title: 'Correct Score', selections: [
        { id: '103', label: '2-1', decimal: '6.0000' },
        { id: '104', label: '1-1', decimal: '9.0000' },
      ] },
    ])).toBeNull();
  });

  it('falls back to complete named double-chance or goal totals, never single offers', () => {
    const best = pickHeadlineMarket([
      { key: 'goals', title: 'Match Goals', selections: [
        { id: '1', label: 'Over 2.5', decimal: '2.1000' },
        { id: '2', label: 'Under 2.5', decimal: '1.7000' },
      ] },
      { key: 'main-suspended', title: 'Fulltime Result', selections: [
        { id: '3', label: 'Home', decimal: '1.8000' },
      ] },
      { key: 'chance', title: 'Double Chance', selections: [
        { id: '4', label: 'Home or Draw', decimal: '1.2500' },
        { id: '5', label: 'Away or Draw', decimal: '1.9000' },
      ] },
    ]);
    expect(best?.key).toBe('chance');
  });

  it('does not present goals totals with only one named side as a balanced headline', () => {
    expect(pickHeadlineMarket([
      { key: 'one-sided', title: 'Total Goals', selections: [
        { id: '1', label: 'Over 2.5', decimal: '2.1000' },
        { id: '2', label: 'Over 3.5', decimal: '3.8000' },
      ] },
    ])).toBeNull();
  });

});
