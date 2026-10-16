import { describe, expect, it } from 'vitest';
import { hasDisplayedLiveOdds, rankLiveFixturesWithOdds } from '@/lib/odds/live-match-priority';
import type { Match } from '@/lib/types';

const fixture = (id: string, price: bigint | null, marketStatus = 'open',
  selectionStatus = 'active', available = true) => ({
  id,
  isBettingAvailable: available,
  topMarkets: price == null ? undefined : [{
    id: id + '-m', key: 'h2h', status: marketStatus,
    selections: [{ id: id+'-s', oddsScaled: price, status: selectionStatus }],
  }],
}) as unknown as Pick<Match, 'id' | 'isBettingAvailable' | 'topMarkets'>;

describe('live sports odds display priority', () => {
  it('puts genuinely available odds first but retains unavailable fixtures', () => {
    const input = [fixture('empty-1', null), fixture('priced-1', 33400n),
      fixture('suspended', 25000n, 'suspended'), fixture('priced-2', 18900n),
      fixture('empty-2', null)];
    expect(rankLiveFixturesWithOdds(input).map(x => x.id)).toEqual([
      'priced-1', 'priced-2', 'empty-1', 'suspended', 'empty-2',
    ]);
    expect(input[0]?.id).toBe('empty-1');
  });
  it('never treats stale, suspended, missing, or nonsensical prices as tradable', () => {
    expect(hasDisplayedLiveOdds(fixture('a', null))).toBe(false);
    expect(hasDisplayedLiveOdds(fixture('b', 12000n, 'suspended'))).toBe(false);
    expect(hasDisplayedLiveOdds(fixture('c', 12000n, 'open', 'suspended'))).toBe(false);
    expect(hasDisplayedLiveOdds(fixture('d', 12000n, 'open', 'active', false))).toBe(false);
    expect(hasDisplayedLiveOdds(fixture('e', 10000n))).toBe(false);
    expect(hasDisplayedLiveOdds(fixture('f', 17420n))).toBe(true);
  });
});
