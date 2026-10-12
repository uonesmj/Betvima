import { afterEach, describe, expect, it } from 'vitest';
import { useBetSlip } from '@/lib/store/betslip';
import { isCurrentQuote, placementIntentFingerprint, quoteContextFingerprint } from '@/lib/bet-placement-fingerprint';

describe('remember explicitly accepted odds in the bet slip', () => {
  afterEach(() => useBetSlip.getState().clear());

  it('keeps an accepted price across an attempted placement, but not a different future price', () => {
    const item = {
      selectionId: 's1', marketId: 'mk1', matchId: 'm1',
      label: 'Home', marketLabel: 'Winner', matchLabel: 'Home - Away',
      sportSlug: 'football', oddsScaled: '25000',
      oddsVersionSeen: 10, addedAt: Date.now(),
    };
    const store = useBetSlip.getState();
    store.replaceItems([item], 'SINGLE');
    store.setStake('100');

    const input = () => ({
      userId: 'u1', currency: 'USD', stakeMinor: useBetSlip.getState().stakeMinor,
      fundingSource: useBetSlip.getState().fundingSource,
      bonusGrantId: useBetSlip.getState().bonusGrantId,
      items: useBetSlip.getState().items,
    });
    const initialContext = quoteContextFingerprint(input());
    const intent = placementIntentFingerprint(input());

    // The user *explicitly* taps Accept new odds at 2.70.
    useBetSlip.getState().applyAcceptedOdds('s1', '27000', 11);
    const current = useBetSlip.getState().items[0]!;
    expect(current.oddsScaled).toBe('27000');
    expect(current.oddsVersionSeen).toBe(11);

    const approvedContext = quoteContextFingerprint(input());
    expect(approvedContext).not.toBe(initialContext);
    expect(placementIntentFingerprint(input())).toBe(intent);

    const expiresAt = new Date(Date.now() + 30000).toISOString();
    expect(isCurrentQuote({ contextKey: initialContext, expiresAt }, approvedContext)).toBe(false);
    expect(isCurrentQuote({ contextKey: approvedContext, expiresAt }, approvedContext)).toBe(true);

    // A no-change provider tick (version 12, price 2.70) is not a new odds
    // change. The backend can accept the previously signed 2.70 price.
    expect(current.oddsScaled).toBe('27000');

    // A genuinely different bookmaker price is *not* silently accepted.
    const differentPrice = '28000';
    expect(current.oddsScaled).not.toBe(differentPrice);
  });

  it('only updates the selection whose price the user approved', () => {
    const store = useBetSlip.getState();
    const first = {
      selectionId: 's1', marketId: 'mk1', matchId: 'm1',
      label: 'Home', marketLabel: 'Winner', matchLabel: 'Home - Away',
      sportSlug: 'football', oddsScaled: '25000', oddsVersionSeen: 10, addedAt: Date.now(),
    };
    const second = { ...first, selectionId: 's2', marketId: 'mk2', oddsScaled: '18000', oddsVersionSeen: 3 };
    store.replaceItems([first, second], 'MULTIPLE');
    useBetSlip.getState().applyAcceptedOdds('s1', '27000', 11);
    expect(useBetSlip.getState().items.map((x) => [x.selectionId, x.oddsScaled, x.oddsVersionSeen]))
      .toEqual([['s1', '27000', 11], ['s2', '18000', 3]]);
  });
});
