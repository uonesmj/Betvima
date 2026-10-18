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
    expect(result?.selections[1].decimal).toBe('1.2500');
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
});
