import { describe, expect, it } from 'vitest';
import { getLiveEventMarker } from '@/lib/live-event-position';

describe('live event pitch marker', () => {
  it('places an event on the half of the team explicitly reported by the provider', () => {
    expect(getLiveEventMarker('home-id', 'home-id', 'away-id')).toEqual({ x: 65, y: 50, side: 'home' });
    expect(getLiveEventMarker('away-id', 'home-id', 'away-id')).toEqual({ x: 35, y: 50, side: 'away' });
  });

  it('does not invent a side when the event has no matching team ID', () => {
    expect(getLiveEventMarker(null, 'home-id', 'away-id')).toBeNull();
    expect(getLiveEventMarker('unknown-id', 'home-id', 'away-id')).toBeNull();
    expect(getLiveEventMarker('home-id', null, 'away-id')).toBeNull();
  });
});
