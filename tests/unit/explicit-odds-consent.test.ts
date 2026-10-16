import { describe, expect, it } from 'vitest';
import { actualOddsMovement, hasExplicitOddsConsent } from '@/lib/odds/explicit-consent';

const moved = [{ selectionId:'s-1', previousOddsScaled:'18000',
  currentOddsScaled:'19500', direction:'UP' as const }];
describe('Odds consent is not wager submission', () => {
  it('requires a user-accepted signed token and exact current slip context', () => {
    expect(hasExplicitOddsConsent(null,'signed-quote-1','slip-1',moved)).toBe(false);
    const accepted={quoteToken:'signed-quote-1',contextKey:'slip-1'};
    expect(hasExplicitOddsConsent(accepted,'signed-quote-1','slip-1',moved)).toBe(true);
    expect(hasExplicitOddsConsent(accepted,'signed-quote-2','slip-1',moved)).toBe(false);
    expect(hasExplicitOddsConsent(accepted,'signed-quote-1','changed-stake',moved)).toBe(false);
    expect(hasExplicitOddsConsent(accepted,null,'slip-1',moved)).toBe(false);
    expect(hasExplicitOddsConsent(null,'signed-quote-1','slip-1',[])).toBe(true);
  });
  it('labels decreases and increases using numeric prices, not provider labels', () => {
    expect(actualOddsMovement(moved[0]!)).toBe('UP');
    expect(actualOddsMovement({...moved[0]!, previousOddsScaled:'21000',
      currentOddsScaled:'18000',direction:'UP'})).toBe('DOWN');
    expect(actualOddsMovement({...moved[0]!, currentOddsScaled:'18000'})).toBe('SAME');
  });
});
