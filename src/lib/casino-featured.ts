/** Categorise games only from supplier-declared game_type, not their marketing names. */
export type CasinoCatalogueCategory = { game_type: string };

export function casinoGameGroup(game: CasinoCatalogueCategory): 'slots' | 'live' | 'other' {
  const category = game.game_type.toLowerCase();
  if (/(?:^|[^a-z])(live|dealer)(?:$|[^a-z])/.test(category)) return 'live';
  if (/slot/.test(category)) return 'slots';
  return 'other';
}

/** Surface both casino verticals even when the supplier lists thousands of slots first. */
export function featuredCasinoGames<T extends CasinoCatalogueCategory>(games: readonly T[]): T[] {
  const slots = games.filter((game) => casinoGameGroup(game) === 'slots').slice(0, 4);
  const live = games.filter((game) => casinoGameGroup(game) === 'live').slice(0, 4);
  return [...slots, ...live];
}
