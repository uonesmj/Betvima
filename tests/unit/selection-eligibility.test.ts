import { describe, expect, it } from 'vitest';
import { isDisplayBettableSelection } from '@/lib/odds/selection-eligibility';

const valid = {
  matchBettingAvailable: true,
  marketStatus: 'open',
  selectionStatus: 'open',
  oddsScaled: '33500',
};

describe('sportsbook price button availability', () => {
  it('accepts genuine scaled bookmaker prices, including the 3.35 screenshot case', () => {
    expect(isDisplayBettableSelection(valid)).toBe(true);
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '17500' })).toBe(true);
    expect(isDisplayBettableSelection({ ...valid, marketStatus: 'active' })).toBe(true);
  });
  it('does not reject every numeric price due to an escaped regex backslash', () => {
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '12450' })).toBe(true);
  });
  it('fails closed for unavailable fixtures, markets and suspended outcomes', () => {
    expect(isDisplayBettableSelection({ ...valid, matchBettingAvailable: false })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, marketStatus: 'suspended' })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, selectionStatus: 'closed' })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '10000' })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '9999' })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '0' })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '' })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '3.35' })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '\\d+' })).toBe(false);
    expect(isDisplayBettableSelection({ ...valid, oddsScaled: '99999999999999999999999999' })).toBe(false);
  });
});
