import { describe, expect, it } from 'vitest';
import { duePrematchRefreshes, prematchRefreshCadence } from '@/workers/prematch-refresh-cadence';

describe('upcoming bookmaker price refresh cadence', () => {
  it('only schedules actual The Odds API provider; rejects other sources', () => {
    const odds = prematchRefreshCadence('the_odds_api', 40);
    const retired = prematchRefreshCadence('retired_vendor', 40);
    expect(odds.midMs).toBe(30_000);
    expect(odds.farMs).toBe(45_000);
    expect(retired.nearLimit).toBe(0);
    expect(retired.midLimit).toBe(0);
    expect(retired.farLimit).toBe(0);
    expect(retired.extendedLimit).toBe(0);
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
  it('never schedules an unauthorized provider for bookmaker refresh', () => {
    const unavailable = prematchRefreshCadence('retired_vendor', 40);
    const cadence = prematchRefreshCadence('the_odds_api', 40);
    const last = { near: 100_000, mid: 100_000, far: 100_000, extendedNear: 100_000, extendedFar: 100_000 };
    expect(duePrematchRefreshes(150_000, last, unavailable).mid).toBe(false);
    expect(duePrematchRefreshes(150_000, last, cadence).mid).toBe(true);
  });
});
