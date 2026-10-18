import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { exploreBetsApi } from '@/providers/betsapi-explorer';
import { betsApiToken } from '@/server/betsapi-feed';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bet365 Match Markets | BetVima' };

/**
 * Read-only market inspector in the ordinary sportsbook navigation.
 * Pricing IDs are NOT accepted by the wager engine; display must not imply bet execution.
 */
export default async function EventPage({
  params, searchParams,
}: {
  params: Promise<{ fi: string }>;
  searchParams: Promise<{ mode?: string; sportId?: string }>;
}) {
  const { fi } = await params;
  const q = await searchParams;
  const mode = q.mode === 'upcoming' ? 'upcoming' : 'live';
  const sportId = Number(q.sportId ?? '1');
  const sport = Number.isInteger(sportId) && sportId > 0 ? sportId : 1;
  const valid = /^\d{1,16}$/.test(fi);
  const data = valid
    ? await exploreBetsApi(betsApiToken(), { mode, sportId: sport, fi })
    : null;
  const markets = data && 'markets' in data ? data.markets : [];
  const error = !valid ? 'INVALID_FIXTURE' : data && 'error' in data ? data.error : 'PROVIDER_UNAVAILABLE';
  return <PageShell>
    <main className="mx-3 space-y-4 pb-24 pt-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Link href={mode === 'live' ? '/live' : '/sports/football'} className="text-sm text-[#087FF5]">← Back to {mode}</Link>
        <h1 className="mt-2 text-xl font-extrabold">Bet365 · Match markets</h1>
        <p className="mt-1 text-sm text-slate-500">Fixture {fi} · {mode === 'live' ? 'In-play' : 'Pre-match'}</p>
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          Odds shown are read-only BetsAPI prices. Bet placement is disabled until settlement and price acceptance are validated.
        </p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">Market data unavailable: {error}</p>}
      {!error && markets.length === 0 && <p className="rounded-xl bg-white p-4">No priced markets supplied for this fixture.</p>}
      {!error && <div className="grid gap-3 md:grid-cols-2">
        {markets.map(m => <section key={m.key} className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-extrabold text-slate-800">{m.title}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {m.selections.map(s => <div key={s.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="truncate text-xs text-slate-600" title={s.label}>{s.label}</p>
              <strong className="text-sm text-slate-800">{s.decimal}</strong>
            </div>)}
          </div>
        </section>)}
      </div>}
    </main>
  </PageShell>;
}
