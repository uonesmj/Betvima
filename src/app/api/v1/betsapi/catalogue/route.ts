import { jsonOk, withErrorHandling } from '@/lib/errors';
import { getBetsApiHomepage, getBetsApiSport } from '@/server/betsapi-feed';
import { readManualFixtures } from '@/server/manual-fixtures';
import { sportByKey } from '@/lib/betsapi-sports-map';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public, read-only, rate-budgeted BetsAPI catalogue; never returns an API token. */
export const GET = withErrorHandling('betsapi.catalogue', async (_ctx, request: Request) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') ?? 'home';
  if (mode === 'home') {
    const [provider, manual] = await Promise.all([
      getBetsApiHomepage(),
      readManualFixtures(undefined, 12),
    ]);
    // Manual events are catalogue-only; they never acquire a provider price or event ID.
    return jsonOk({
      ...provider,
      upcoming: [...manual, ...provider.upcoming].slice(0, 12),
      manualCount: manual.length,
    });
  }
  if (mode !== 'live' && mode !== 'upcoming')
    return jsonOk({ source: 'betsapi_bet365', error: 'INVALID_MODE', matches: [] });
  const sportKey = url.searchParams.get('sport') || 'football';
  if (!sportByKey(sportKey)) return jsonOk({ source: 'betsapi_bet365', error: 'UNSUPPORTED_SPORT', matches: [] });
  const leagueId = url.searchParams.get('leagueId') || undefined;
  if (leagueId && !/^\d{1,16}$/.test(leagueId))
    return jsonOk({ source: 'betsapi_bet365', error: 'INVALID_LEAGUE', matches: [] });
  const rawPage = Number(url.searchParams.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) ? Math.max(1, Math.min(100, rawPage)) : 1;
  const [provider, manual] = await Promise.all([
    getBetsApiSport(mode, sportKey, page, leagueId),
    mode === 'upcoming' && page === 1 && !leagueId
      ? readManualFixtures(sportKey, 25)
      : Promise.resolve([]),
  ]);
  if (manual.length === 0) return jsonOk(provider);
  // The standalone Android client consumes this catalogue, not /api/v1/matches.
  // Never map a manual ID to the BetsAPI namespace or turn on its wager flag.
  return jsonOk({
    ...provider,
    matches: [...manual, ...provider.matches],
    total: provider.total === null ? null : provider.total + manual.length,
    manualCount: manual.length,
    // Preserve provider failure diagnostics without hiding independent manual entries.
    providerError: provider.error,
    error: null,
  });
});
