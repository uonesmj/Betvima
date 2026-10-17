import { describe, expect, it } from 'vitest';
import { casinoGameGroup, featuredCasinoGames } from '@/lib/casino-featured';

describe('casino homepage featured selection', () => {
  it('selects slots and live dealer games from the entire catalogue', () => {
    const games = Array.from({ length: 120 }, (_, i) => ({ id: String(i), game_type: 'Slots' }))
      .concat([{ id: 'live-one', game_type: 'Live Casino' }, { id: 'live-two', game_type: 'Live Dealer' }]);
    expect(featuredCasinoGames(games).map((g) => g.id))
      .toEqual(['0', '1', '2', '3', 'live-one', 'live-two']);
  });
  it('does not falsely label RNG or table games as live', () => {
    expect(casinoGameGroup({ game_type: 'Roulette' })).toBe('other');
    expect(casinoGameGroup({ game_type: 'Live Roulette' })).toBe('live');
    expect(casinoGameGroup({ game_type: 'Slot Machines' })).toBe('slots');
  });
  it('returns an empty list if the supplier has no eligible games', () => {
    expect(featuredCasinoGames([{ game_type: 'Sports' }])).toEqual([]);
  });
});
