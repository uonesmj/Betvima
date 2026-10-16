import { describe, expect, it } from 'vitest';
import { DEMO_LIVE_FOOTBALL_FIXTURES } from '@/lib/football-live-demo';
import {
  FOOTBALL_PREVIEW_BETTING_ENABLED, footballLeagues,
  parseLicensedFootballFeed, renderableOdds,
} from '@/lib/football-live-feed';

const now = Date.parse('2026-10-16T19:00:00Z');
const payload = () => ({
  source: { providerId: 'fictional-test-provider',
    commercialUsePermitted: true, licenceReference: 'SIMULATED_TEST_DATA_ONLY' },
  receivedAtUtc: new Date(now).toISOString(),
  fixtures: structuredClone(DEMO_LIVE_FOOTBALL_FIXTURES),
});

describe('football live research data contract (never production trading)', () => {
  it('rejects input without explicit commercial rights, including fictional data', () => {
    const value = payload();
    value.source.commercialUsePermitted = false;
    expect(parseLicensedFootballFeed(value, now)).toEqual({
      ok: false, reason: 'commercial_rights_unverified', fixtures: [], readOnly: true,
    });
    value.source.commercialUsePermitted = true;
    value.source.licenceReference = '';
    expect(parseLicensedFootballFeed(value, now).ok).toBe(false);
  });

  it('accepts arbitrary named markets, scores, incidents and stats in the schema', () => {
    const result = parseLicensedFootballFeed(payload(), now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fixtures).toHaveLength(3);
    expect(result.fixtures[0]!.markets.length).toBeGreaterThan(8);
    expect(result.fixtures[0]!.incidents[0]!.type).toBe('goal');
    expect(result.readOnly).toBe(true);
    expect(FOOTBALL_PREVIEW_BETTING_ENABLED).toBe(false);
  });

  it('rejects a missing or stale transport heartbeat even when displayed price did not change', () => {
    const value = payload();
    expect(parseLicensedFootballFeed(value, now + 20_001)).toEqual({
      ok: false, reason: 'feed_stale', fixtures: [], readOnly: true,
    });
    value.fixtures[0]!.markets[0]!.lastPriceChangeUtc = '2026-10-01T00:00:00Z';
    // Last price *change* is not a feed heartbeat.
    expect(parseLicensedFootballFeed(value, now).ok).toBe(true);
    value.receivedAtUtc = new Date(now + 6_000).toISOString();
    expect(parseLicensedFootballFeed(value, now).ok).toBe(false);
  });

  it('rejects duplicate events, markets and selections without partial updates', () => {
    const value = payload();
    value.fixtures.push(structuredClone(value.fixtures[0]!));
    expect(parseLicensedFootballFeed(value, now).ok).toBe(false);
    value.fixtures.pop();
    value.fixtures[0]!.markets.push(structuredClone(value.fixtures[0]!.markets[0]!));
    expect(parseLicensedFootballFeed(value, now).ok).toBe(false);
    value.fixtures[0]!.markets.pop();
    value.fixtures[0]!.markets[0]!.selections.push(structuredClone(value.fixtures[0]!.markets[0]!.selections[0]!));
    expect(parseLicensedFootballFeed(value, now).ok).toBe(false);
  });

  it('suspends missing, closed, and halftime-closed odds for display', () => {
    const choice = DEMO_LIVE_FOOTBALL_FIXTURES[0]!.markets[0]!.selections[0]!;
    expect(renderableOdds('live', 'open', choice)).toBe('2.16');
    expect(renderableOdds('live', 'closed', choice)).toBe('—');
    expect(renderableOdds('suspended', 'open', choice)).toBe('—');
    expect(renderableOdds('finished', 'open', choice)).toBe('—');
    expect(renderableOdds('live', 'open', { ...choice, decimalOdds: null })).toBe('—');
  });

  it('supports league grouping without dropping duplicate-league fixtures', () => {
    expect(footballLeagues(DEMO_LIVE_FOOTBALL_FIXTURES).map(l => l.count)
      .sort((a,b) => b-a)).toEqual([2,1]);
  });

  it('rejects structurally incomplete incident, stats and odds payloads', () => {
    expect(parseLicensedFootballFeed({ ...payload(), fixtures: [{ id: 'incomplete' }] }, now).ok)
      .toBe(false);
    const value = payload();
    value.fixtures[0]!.markets[0]!.selections[0]!.decimalOdds = -1;
    expect(parseLicensedFootballFeed(value, now).ok).toBe(false);
  });
});
