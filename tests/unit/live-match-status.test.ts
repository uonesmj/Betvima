import { describe, expect, it } from 'vitest';
import { isLiveMatchStatus, LIVE_MATCH_STATUSES } from '@/lib/match-state';

describe('live match status coverage', () => {
  it('treats every provider in-play state as live for odds polling and placement', () => {
    for (const status of LIVE_MATCH_STATUSES) {
      expect(isLiveMatchStatus(status)).toBe(true);
    }
  });
});
