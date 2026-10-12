import { describe, expect, it } from 'vitest';
import { isCurrentQuote, placementIntentFingerprint, quoteContextFingerprint, type PlacementFingerprintInput } from '@/lib/bet-placement-fingerprint';

const base: PlacementFingerprintInput = {
  userId: 'u1', currency: 'USD', stakeMinor: '100',
  fundingSource: 'main', bonusGrantId: null,
  items: [
    { matchId: 'm1', marketId: 'mk1', selectionId: 's1', oddsScaled: '25000', oddsVersionSeen: 2 },
    { matchId: 'm2', marketId: 'mk2', selectionId: 's2', oddsScaled: '17000', oddsVersionSeen: 1 },
  ],
};

describe('bet placement client context and retry safety', () => {
  it('rejects a signed quote cached for a different amount, account, wallet or pick', () => {
    const original = quoteContextFingerprint(base);
    const expiresAt = new Date(Date.now() + 30000).toISOString();
    expect(isCurrentQuote({ contextKey: original, expiresAt }, original)).toBe(true);
    for (const different of [
      { ...base, stakeMinor: '200' },
      { ...base, currency: 'IRR' },
      { ...base, userId: 'u2' },
      { ...base, fundingSource: 'bonus', bonusGrantId: 'g1' },
      { ...base, items: base.items.slice(0, 1) },
      { ...base, items: [{ ...base.items[0]!, oddsVersionSeen: 3 }, base.items[1]!] },
      { ...base, items: [{ ...base.items[0]!, oddsScaled: '26000' }, base.items[1]!] },
    ]) {
      expect(isCurrentQuote({ contextKey: original, expiresAt }, quoteContextFingerprint(different))).toBe(false);
    }
    expect(isCurrentQuote({contextKey: original, expiresAt: '2000-01-01T00:00:00Z'}, original)).toBe(false);
  });

  it('deduplicates retries even when provider prices move, but not different stakes or picks', () => {
    const original = placementIntentFingerprint(base);
    expect(placementIntentFingerprint({...base,items: [...base.items].reverse()})).toBe(original);
    expect(placementIntentFingerprint({...base,items:[{...base.items[0]!,oddsScaled:'27000'},base.items[1]!]})).toBe(original);
    expect(placementIntentFingerprint({...base,stakeMinor:'300'})).not.toBe(original);
    expect(placementIntentFingerprint({...base,items:base.items.slice(0,1)})).not.toBe(original);
  });
});
