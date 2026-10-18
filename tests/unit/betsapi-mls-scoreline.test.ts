import { describe, expect, it } from 'vitest';
import { getLeagueLogo, getLocalLeagueLogo } from '@/lib/team-logo';
import { parseBet365LivePreview } from '@/providers/betsapi-bet365-preview';

describe('Bet365 event view logo and named correct scores', () => {
  it('uses the bundled MLS badge, not the unrelated rainbow-flag SVG', () => {
    expect(getLocalLeagueLogo('USA MLS')).toBe('/sports/leagues/mls.png');
    expect(getLocalLeagueLogo('Major League Soccer')).toBe('/sports/leagues/mls.png');
    expect(getLeagueLogo({ name: 'USA MLS', sportKey: 'football' })).toBe('/sports/leagues/mls.png');
  });

  it('omits numeric MA subgroup metadata in a correct-score offer', () => {
    const p = parseBet365LivePreview('201588143', [[
      { type: 'MG', ID: '1000', NA: 'Final Score' },
      { type: 'MA', ID: '1', NA: '1' },
      { type: 'PA', ID: '11', NA: '5-2', OD: '125/1' },
      { type: 'PA', ID: '12', NA: '5-3', OD: '250/1' },
      { type: 'MA', ID: '2', NA: '2' },
      { type: 'PA', ID: '13', NA: '0-0', OD: '8/1' },
    ]]);
    expect(p.markets[0]?.selections.map(s => s.label)).toEqual(['5-2', '5-3', '0-0']);
    expect(p.markets[0]?.selections.map(s => s.decimal)).toEqual(['126.0000','251.0000','9.0000']);
  });

  it('preserves actual named MA context in other live market groups', () => {
    const p = parseBet365LivePreview('201588144', [[
      { type: 'MG', ID: '1001', NA: 'Match Goals' },
      { type: 'MA', ID: '2', NA: 'Over 2.5' },
      { type: 'PA', ID: '14', NA: 'Team A', OD: '9/10' },
    ]]);
    expect(p.markets[0]?.selections[0]?.label).toBe('Over 2.5 · Team A');
  });
});
