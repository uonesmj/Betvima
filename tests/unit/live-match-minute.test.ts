import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isFreshFiveDollarClock, matchMinuteLabel } from '@/lib/live-match-minute';

describe('FiveDollar match minute display', () => {
  it('shows the exact provider minute, not a locally estimated timer', () => {
    expect(matchMinuteLabel(7, null)).toBe("7'");
    expect(matchMinuteLabel(44, 'first_half')).toBe("44'");
    expect(matchMinuteLabel(45, 'second_half')).toBe("45'");
    expect(matchMinuteLabel(0, null)).toBe("0'");
    expect(matchMinuteLabel(90, null)).toBe("90'");
  });

  it('shows HT, FT or LIVE without fabricating an unknown minute', () => {
    expect(matchMinuteLabel(45, 'half_time')).toBe('HT');
    expect(matchMinuteLabel(45, 'halftime')).toBe('HT');
    expect(matchMinuteLabel(null, null)).toBe('LIVE');
    expect(matchMinuteLabel(undefined, 'first_half')).toBe('LIVE');
    expect(matchMinuteLabel(999, null)).toBe('LIVE');
    expect(matchMinuteLabel(Number.NaN, null)).toBe('LIVE');
    expect(matchMinuteLabel(90, 'full_time')).toBe('FT');
  });

  it('rejects stale FiveDollar snapshots rather than showing outdated clocks', () => {
    const now = Date.parse('2026-10-13T02:00:00.000Z');
    expect(isFreshFiveDollarClock('5dollarfootballapi', '2026-10-13T01:57:00.000Z', now)).toBe(true);
    expect(isFreshFiveDollarClock('5dollarfootballapi', '2026-10-13T01:54:00.000Z', now)).toBe(false);
    expect(isFreshFiveDollarClock('5dollarfootballapi', null, now)).toBe(false);
    expect(isFreshFiveDollarClock('5dollarfootballapi', 'bad-date', now)).toBe(false);
    expect(isFreshFiveDollarClock('api_football', null, now)).toBe(true);
  });

  it('keeps the 5Dollar clock read-only and limits freshness of matched bookmaker events', () => {
    const catalog = readFileSync('src/server/adapters/postgres/catalog.ts', 'utf8');
    const oddsRoute = readFileSync('src/app/api/v1/matches/[id]/odds/route.ts', 'utf8');
    const hero = readFileSync('src/components/betting/match-hero.tsx', 'utf8');
    for (const source of [catalog, oddsRoute]) {
      expect(source).toContain("ms.provider = '5dollarfootballapi'");
      expect(source).toContain("ms.updated_at >= now() - interval '5 minutes'");
      expect(source.includes('display_minute') || source.includes('as minute')).toBe(true);
    }
    expect(hero).toContain('matchMinuteLabel(match.minute, match.period)');
    expect(hero).not.toContain('liveSeconds');
    expect(hero).not.toContain('setLiveSeconds');
  });
});
