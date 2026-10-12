import { describe, expect, it } from 'vitest';
import { duePrematchRefreshes, prematchRefreshCadence } from '@/workers/prematch-refresh-cadence';

describe('upcoming bookmaker price refresh cadence', () => {
  it('uses the actual The Odds API provider, not legacy SPORTS_PROVIDER env', () => {
    const odds = prematchRefreshCadence('the_odds_api', 40);
    const fiveDollar = prematchRefreshCadence('5dollarfootballapi', 40);
    expect(odds.midMs).toBe(30_000);
    expect(odds.farMs).toBe(45_000);
    expect(fiveDollar.midMs).toBe(300_000);
    expect(fiveDollar.farMs).toBe(900_000);
  });
  it('does not monopolize provider requests with dozens of extended-event calls', () => {
    const cadence = prematchRefreshCadence('the_odds_api', 80);
    expect(cadence.extendedLimit).toBe(8);
    expect(cadence.nearLimit + cadence.midLimit + cadence.farLimit).toBe(40);
  });
  it('keeps separate expiry clocks and does not reschedule unready buckets', () => {
    const cadence = prematchRefreshCadence('the_odds_api', 40);
    const due = duePrematchRefreshes(1_000_000,
      { near: 980_000, mid: 980_000, far: 980_000, extendedNear: 980_000, extendedFar: 980_000 },
      cadence);
    expect(due.near).toBe(true);
    expect(due.mid).toBe(false);
    expect(due.far).toBe(false);
    expect(due.next.mid).toBe(980_000);
  });
  it('respects legacy provider quota pacing and its independent scheduling', () => {
    const fiveDollar = prematchRefreshCadence('5dollarfootballapi', 40);
    const cadence = prematchRefreshCadence('the_odds_api', 40);
    const last = { near: 100_000, mid: 100_000, far: 100_000, extendedNear: 100_000, extendedFar: 100_000 };
    expect(duePrematchRefreshes(150_000, last, fiveDollar).mid).toBe(false);
    expect(duePrematchRefreshes(150_000, last, cadence).mid).toBe(true);
  });
});
