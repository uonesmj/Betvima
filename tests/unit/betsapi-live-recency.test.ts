import { describe, expect, it } from 'vitest';
import { confirmedExistingLiveFixtureIds } from '@/workers/betsapi-live-recency';

describe('BetsAPI in-play fixture recency', () => {
  it('confirms only events observed live and already known to this provider', () => {
    const observed = [
      { providerId: '1:13315754', status: 'live' },
      { providerId: '1:13315754', status: 'live' },
      { providerId: '1:13322002', status: 'live' },
      { providerId: '1:13322005', status: 'finished' },
      { providerId: '1:13322006', status: 'scheduled' },
      { providerId: '18:13322007', status: 'live' },
      { providerId: 'unsafe-identity', status: 'live' },
    ];
    const knownIds = new Set(['1:13315754', '1:13322005', '1:13322006', '18:13322007', 'unsafe-identity']);
    expect(confirmedExistingLiveFixtureIds(observed, knownIds)).toEqual(['1:13315754']);
  });
  it('does not manufacture recency when the provider returns no current live fixtures', () => {
    expect(confirmedExistingLiveFixtureIds([], new Set(['1:13315754']))).toEqual([]);
  });
});
