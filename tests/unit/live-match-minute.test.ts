import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { matchMinuteLabel } from '@/lib/live-match-minute';

describe('Odds API match minute display', () => {
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


  it('reads the canonical minute and never overlays a secondary provider clock', () => {
    const catalog = readFileSync('src/server/adapters/postgres/catalog.ts', 'utf8');
    const oddsRoute = readFileSync('src/app/api/v1/matches/[id]/odds/route.ts', 'utf8');
    const hero = readFileSync('src/components/betting/match-hero.tsx', 'utf8');
    expect(catalog).toContain('m.minute as display_minute');
    expect(oddsRoute).toContain('m.minute, m.period');
    expect(oddsRoute).not.toContain('fdclock');
    expect(oddsRoute).toContain("m.provider = 'the_odds_api'");
    expect(hero).toContain('matchMinuteLabel(match.minute, match.period)');
    expect(hero).not.toContain('setLiveSeconds');
  });

});
