/** Optional read-only Bet365 fixture strip on the main /live page.
 * This never enters catalogue DB, betslip, quote, wallet or settlement.
 */
import 'server-only';
import { readFileSync } from 'node:fs';
import Link from 'next/link';
import { exploreBetsApi } from '@/providers/betsapi-explorer';

function token(): string | null {
  const env = process.env.BETSAPI_TRIAL_TOKEN?.trim();
  if (env && /^[A-Za-z0-9_-]{12,180}$/.test(env)) return env;
  try {
    const value = readFileSync('/etc/betvima/betsapi-token', 'utf8').trim();
    return /^[A-Za-z0-9_-]{12,180}$/.test(value) ? value : null;
  } catch { return null; }
}

export async function BetsApiLiveStrip() {
  if (process.env.BETSAPI_LIVE_SIDEBY_SIDE_ENABLED !== 'true') return null;
  const secret = token();
  if (!secret) return null;
  const data = await exploreBetsApi(secret, { mode: 'live', sportId: 1, feed: 'bet365' });
  if (!('fixtures' in data) || data.error || !data.fixtures.length) return null;
  return (
    <section className="rounded-xl border border-sky-800/40 bg-[#111a2b] p-3 text-white" aria-label="Bet365 live preview">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Bet365 Live · Preview</h2>
          <p className="text-xs text-slate-400">Read-only source fixtures. These games cannot be added to the bet slip or settled yet.</p>
        </div>
        <Link className="text-sm font-semibold text-sky-300 underline" href="/betsapi">Browse markets</Link>
      </div>
      <div className="grid max-h-[65vh] gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2 lg:grid-cols-3">
        {data.fixtures.map(fixture => (
          <div key={fixture.fi} className="rounded-lg border border-white/10 bg-[#192437] p-3 text-sm">
            <p className="mb-1 truncate text-xs text-slate-400">{fixture.league}</p>
            <p className="font-semibold">{fixture.home} — {fixture.away}</p>
            <p className="mt-1 text-xs text-sky-300">{fixture.score ?? 'LIVE'} · Preview only</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">{data.fixtures.length} Bet365 football fixtures available in this scrollable preview.</p>
    </section>
  );
}
