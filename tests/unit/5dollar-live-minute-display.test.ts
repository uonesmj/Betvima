import { describe, expect, it } from 'vitest';
import { matchMinuteLabel } from '@/lib/live-match-minute';
import { readFileSync } from 'node:fs';

describe('5Dollar live football clock presentation', () => {
  it.each([
    [7, null, "7'"],
    [44, 'first_half', "44'"],
    [45, 'first_half', "45'"],
    [66, 'second_half', "66'"],
    [90, 'second_half', "90'"],
    [105, 'extra_time', "105'"],
    [null, null, 'LIVE'],
    [null, 'unknown', 'LIVE'],
    [null, 'half_time', 'HT'],
    [45, 'halftime', 'HT'],
    [null, 'full_time', 'FT'],
    [-1, null, 'LIVE'],
    [133, null, 'LIVE'],
    [14.5, null, 'LIVE'],
  ])('formats minute=%s period=%s safely', (minute, period, expected) => {
    expect(matchMinuteLabel(minute, period)).toBe(expected);
  });

  it('uses provider time on the list and match detail without fabricating seconds', () => {
    const card = readFileSync('src/components/betting/match-card.tsx', 'utf8');
    const hero = readFileSync('src/components/betting/match-hero.tsx', 'utf8');
    const refresh = readFileSync('src/components/betting/live-match-refresh.tsx', 'utf8');
    const client = readFileSync('src/components/betting/live-match-center-client.tsx', 'utf8');
    expect(card).toContain('matchMinuteLabel(match.minute, match.period)');
    expect(hero).toContain('matchMinuteLabel(match.minute, match.period)');
    expect(hero).not.toContain('setLiveSeconds');
    expect(refresh).not.toContain("document.querySelectorAll<HTMLElement>('[data-live-minute]')");
    expect(client).toContain('period: live.period');
  });
});
