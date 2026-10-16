/**
 * Catalogue facets are computed from the *entire* supplier catalogue, not
 * just the current paginated 40-card view. Category/search scope provider
 * choices; the selected provider only scopes the returned games.
 */
export function filterCasinoCatalogue<T extends {
  game_type: string; provider: string; name: string;
}>(
  all: readonly T[],
  filters: { category: string; provider: string; search: string },
): { games: T[]; providers: string[] } {
  const scoped = all.filter((game) =>
    (!filters.category || game.game_type.toLowerCase() === filters.category) &&
    (!filters.search || game.name.toLowerCase().includes(filters.search)));

  const providers = [...new Set(scoped.map((game) => game.provider).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const games = scoped.filter((game) => !filters.provider ||
    game.provider.toLowerCase() === filters.provider);

  return { games, providers };
}
