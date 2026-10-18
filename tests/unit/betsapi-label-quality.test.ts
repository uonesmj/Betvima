import { describe, expect, it } from 'vitest';
import { labelTier } from '../../src/providers/betsapi-label-quality';

describe('BetsAPI read-only outcome classification', () => {
  it('preserves explicit names as named', () => {
    expect(labelTier('Over 2.5', 'Match Goals')).toBe('named');
    expect(labelTier('Home FC', 'Fulltime Result')).toBe('named');
  });
  it('marks known sides and numeric lines as partial only', () => {
    expect(labelTier('Over · Unlabelled outcome #123 · line 3.5', 'Match Goals')).toBe('partial');
    expect(labelTier('Under · Unlabelled outcome #124 · line 10.5', 'Corners')).toBe('partial');
    expect(labelTier('Away FC · Unlabelled outcome #125 · line +0.5', 'Asian Handicap')).toBe('partial');
  });
  it('does not invent identity from vague labels', () => {
    expect(labelTier('2 or More · Unlabelled outcome #222', 'Multi Scorers')).toBe('unresolved');
    expect(labelTier('Yes · Unlabelled outcome #223', 'Last Goalscorer Or Substitute')).toBe('unresolved');
    expect(labelTier('Draw · Unlabelled outcome #224 · line +1', '3-Way Handicap')).toBe('unresolved');
    expect(labelTier('Unlabelled outcome #225 · line 3', 'Match Goals')).toBe('unresolved');
  });
});
