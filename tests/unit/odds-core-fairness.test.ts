import { describe, expect, it } from 'vitest';
import { rotateCoreSportGroups } from '@/providers/odds-core-fairness';

describe('bounded core odds refresh fairness', () => {
  const groups: Array<[string, string[]]> = [
    ['soccer_epl', ['1']],
    ['soccer_germany_bundesliga', ['2']],
    ['basketball_nba', ['3']],
    ['cricket_t20_blast', ['4']],
  ];

  it('gives every sport the first scarce request slot once per rotation', () => {
    const first = Array.from({ length: groups.length }, (_, n) =>
      rotateCoreSportGroups(groups, n)[0]?.[0],
    );
    expect(first).toEqual(groups.map(([key]) => key));
  });

  it('keeps every event group intact without duplicating or changing odds', () => {
    for (let cycle = 0; cycle < 16; cycle++) {
      const rotated = rotateCoreSportGroups(groups, cycle);
      expect(rotated.length).toBe(groups.length);
      expect(new Map(rotated)).toEqual(new Map(groups));
      expect(new Set(rotated.map(([key]) => key)).size).toBe(groups.length);
    }
  });

  it('handles empty and offset cycles safely', () => {
    expect(rotateCoreSportGroups([], 17)).toEqual([]);
    expect(rotateCoreSportGroups(groups, 4)).toEqual(rotateCoreSportGroups(groups, 0));
    expect(rotateCoreSportGroups(groups, -1)[0]?.[0]).toBe('cricket_t20_blast');
  });
});
