import { PageShell } from '@/components/layout/page-shell';
import { BetsApiEventMarkets } from '@/components/betsapi/betsapi-event-markets';
import { readBetsApiMarkets } from '@/server/betsapi-market-cache';
import { getBetsApiSport } from '@/server/betsapi-feed';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Match markets | BetVima' };

/** Real Bet365 prices; read-only until a verified wagering integration exists. */
export default async function EventPage({
  params, searchParams,
}: {
  params: Promise<{ fi: string }>;
  searchParams: Promise<{ mode?: string; sportId?: string; home?: string; away?: string; kickoff?: string }>;
}) {
  const { fi } = await params;
  const q = await searchParams;
  const mode = q.mode === 'upcoming' ? 'upcoming' : 'live';
  const sportId = Number(q.sportId ?? '1');
  const sport = BETSAPI_SPORTS.find(s => s.id === sportId);
  const valid = /^\d{1,16}$/.test(fi) && Boolean(sport);
  const [details, listing] = valid && sport
    ? await Promise.all([
        readBetsApiMarkets(mode, sportId, fi),
        getBetsApiSport(mode, sport.key),
      ])
    : [null, null];
  const markets = details && 'markets' in details ? details.markets : [];
  const marketCount = details && 'marketCount' in details ? details.marketCount : 0;
  const error = !valid ? 'INVALID_FIXTURE' : details && 'error' in details ? details.error : 'PROVIDER_UNAVAILABLE';
  const initial = q.home && q.away && q.kickoff && q.home.length <= 140 && q.away.length <= 140
    && q.home !== q.away && Number.isFinite(Date.parse(q.kickoff))
    ? { home: q.home, away: q.away, kickoff: q.kickoff } : undefined;
  const fixture = listing?.matches.find(match => match.id === `betsapi:${mode}:${sportId}:${fi}`) ?? null;

  return <PageShell>
    <BetsApiEventMarkets fi={fi} mode={mode} sportKey={sport?.key ?? 'football'}
      fixture={fixture} initial={initial} markets={markets} error={error} reportedCount={marketCount} />
  </PageShell>;
}
