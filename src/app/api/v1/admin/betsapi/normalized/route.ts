import { jsonOk, withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { BetsApiSportsProvider } from '@/providers/betsapi-sports';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Report {
  activeSource: 'the_odds_api';
  inspectedSource: 'betsapi';
  mode: 'shadow_read_only';
  checkedAt: string;
  configured: boolean;
  liveCount: number;
  live: Array<{
    providerId: string; sport: string; home: string; away: string;
    score: string | null; minute: number | null;
    marketCount: number; selectionCount: number;
    markets: Array<{ key: string; selections: Array<{ code: string; decimalOdds: string }> }>;
  }>;
  diagnostic: string | null;
}

// A bounded, coalesced preview avoids consuming the trial hourly quota
// repeatedly when multiple admin sessions load the same page.
let inflight: Promise<Report> | null = null;
let cached: { at: number; value: Report } | null = null;
async function preview(): Promise<Report> {
  if (cached && Date.now() - cached.at < 120_000) return cached.value;
  if (inflight) return inflight;
  inflight = (async () => {
    const provider = new BetsApiSportsProvider();
    const out: Report = {
      activeSource: 'the_odds_api', inspectedSource: 'betsapi',
      mode: 'shadow_read_only', configured: provider.configured,
      checkedAt: new Date().toISOString(), liveCount: 0,
      live: [], diagnostic: null,
    };
    if (!provider.configured) {
      out.diagnostic = 'NOT_CONFIGURED';
      return out;
    }
    const live = await provider.fetchLiveMatches('football');
    if (!live.ok || !live.value) {
      out.diagnostic = live.errorCode ?? 'BETSAPI_UNAVAILABLE';
      return out;
    }
    out.liveCount = live.value.length;
    // No database reads or writes: all data comes from the shadow feed.
    for (const match of live.value.slice(0, 2)) {
      const price = await provider.fetchOdds([match.providerId]);
      const markets = price.ok ? (price.value?.[0]?.markets ?? []) : [];
      out.live.push({
        providerId: match.providerId,
        sport: match.sport, home: match.homeTeamName, away: match.awayTeamName,
        score: match.homeScore !== null && match.awayScore !== null
          ? `${match.homeScore}-${match.awayScore}` : null,
        minute: match.minute, marketCount: markets.length,
        selectionCount: markets.reduce((sum, m) => sum + m.selections.length, 0),
        markets: markets.slice(0, 5).map(m => ({
          key: m.key, selections: m.selections.slice(0, 3).map(s => ({
            code: s.code, decimalOdds: s.odds,
          })),
        })),
      });
    }
    return out;
  })().then(value => {
    cached = { at: Date.now(), value };
    return value;
  }).finally(() => { inflight = null; });
  return inflight;
}
export const GET = withErrorHandling('admin.betsapi.normalized', async (ctx, request: Request) => {
  await withAdmin(request, ctx, 'settings.view');
  return jsonOk(await preview());
});
