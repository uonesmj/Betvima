import { describe, expect, it } from 'vitest';
import { filterCasinoCatalogue } from '@/server/providers/softaggregator/catalogue-filters';

const games = [
  { id_hash: 'a', name: 'Golden Slot', provider: 'Studio Alpha', game_type: 'slots' },
  { id_hash: 'b', name: 'Other Slot', provider: 'Studio Beta', game_type: 'slots' },
  { id_hash: 'c', name: 'Golden Live', provider: 'Studio Gamma', game_type: 'live' },
  { id_hash: 'd', name: 'Golden Slot 2', provider: 'Studio Gamma', game_type: 'slots' },
];

describe('complete SoftAggregator catalogue facets', () => {
  it('lists providers beyond the selected first page and preserves studio filtering', () => {
    const { games: filtered, providers } = filterCasinoCatalogue(games, {
      category: 'slots', provider: 'studio gamma', search: '',
    });
    expect(providers).toEqual(['Studio Alpha', 'Studio Beta', 'Studio Gamma']);
    expect(filtered.map((game) => game.id_hash)).toEqual(['d']);
  });

  it('recomputes providers across category and search, independent of selected provider', () => {
    const result = filterCasinoCatalogue(games, {
      category: 'slots', search: 'golden', provider: 'studio beta',
    });
    expect(result.providers).toEqual(['Studio Alpha', 'Studio Gamma']);
    expect(result.games).toEqual([]);
  });

  it('never manufactures options for an empty or unmatched catalogue', () => {
    expect(filterCasinoCatalogue([], { category: '', provider: '', search: '' }))
      .toEqual({ games: [], providers: [] });
    expect(filterCasinoCatalogue(games, { category: 'bingo', provider: '', search: '' }))
      .toEqual({ games: [], providers: [] });
  });
});
