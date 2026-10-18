import { describe, expect, it } from 'vitest';
import { projectBet365ReadOnly } from '../../src/providers/betsapi-bet365-projection';
import type { Bet365Catalogue } from '../../src/providers/betsapi-bet365-catalogue';

describe('Bet365 quarantined odds projection', () => {
  it('keeps only explicit mapped outcomes, suspended statuses, and non-UUID identity', () => {
    const catalogue: Bet365Catalogue = {
      fi: '203034631', mode: 'live', readOnly: true, marketCount: 2, selectionCount: 3,
      markets: [
        { id: 'bet365:203034631:45', name: 'Goals Odd/Even', mode: 'live', settlementCandidate: 'GOALS_ODD_EVEN', status: 'open',
          selections: [
            { id: 'bet365:203034631:45:4', name: 'Odd', odds: '1.9000', status: 'open', line: null, selectionCandidate: 'ODD' },
            { id: 'bet365:203034631:45:5', name: 'Even', odds: '1.8500', status: 'suspended', line: null, selectionCandidate: 'EVEN' },
          ] },
        { id: 'bet365:203034631:46', name: 'Unknown', mode: 'live', settlementCandidate: null, status: 'open',
          selections: [{ id: 'bet365:203034631:46:6', name: 'Unverified', odds: '2.0000', status: 'open', line: null, selectionCandidate: null }] },
      ],
    };
    const result = projectBet365ReadOnly(catalogue, new Date('2026-10-18T10:00:00.000Z'));
    expect(result.executable).toBe(false);
    expect(result.diagnosticsOnly).toBe(true);
    expect(result.preview.matchProviderId).toBe('bet365-preview:203034631');
    expect(result.preview.markets).toHaveLength(1);
    expect(result.preview.markets[0]!.selections.map(x => x.status)).toEqual(['open', 'suspended']);
    expect(result.rejectedSelections).toBe(1);
  });
  it('rejects malformed fixture identity', () => {
    expect(() => projectBet365ReadOnly({fi: 'bad', mode: 'live', markets: [], readOnly: true, marketCount: 0, selectionCount: 0}, new Date())).toThrow('INVALID_PREVIEW_IDENTITY');
  });
});
