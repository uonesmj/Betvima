'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Mode = 'live' | 'upcoming';
type Fixture = { fi: string | null; home: string; away: string; league: string; kickoff: string | null; score: string | null; minute: number | null };
type Response = { ok: boolean; data?: { total: number | null; pageCount: number | null; fixtures: Fixture[]; error: string | null; configured: boolean } };
const SPORTS = [{ id: 1, name: 'Football' }, { id: 18, name: 'Basketball' }, { id: 13, name: 'Tennis' }, { id: 91, name: 'Volleyball' }, { id: 17, name: 'Ice Hockey' }, { id: 3, name: 'Cricket' }, { id: 78, name: 'Handball' }];
const PAGE_SIZE = 35;

/** Non-wagerable catalogue. Provider identities must never be interpreted as local match IDs. */
export function BetsApiCatalogue({ mode }: { mode: Mode }) {
  const [sport, setSport] = useState(1);
  const [page, setPage] = useState(1);
  const [value, setValue] = useState<Response['data']>();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setFailure('');
      try {
        const query = new URLSearchParams({ mode, feed: 'bet365', sportId: String(sport), page: String(page) });
        const res = await fetch('/api/v1/betsapi/explorer?' + query, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('HTTP_ERROR');
        const body = await res.json() as Response;
        if (!body.ok || !body.data) throw new Error('INVALID_RESPONSE');
        if (active) setValue(body.data);
      } catch {
        if (active) { setValue(undefined); setFailure('Unable to load BetsAPI fixtures. Please try again.'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = mode === 'live' ? window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000) : undefined;
    return () => { active = false; controller.abort(); if (timer) window.clearInterval(timer); };
  }, [mode, sport, page]);
  const fixtures = value?.fixtures ?? [];
  const start = mode === 'live' ? 0 : (page - 1) * fixtures.length;
  const visible = mode === 'live' ? fixtures.slice(0, PAGE_SIZE) : fixtures.slice(0, PAGE_SIZE);
  return <section dir="ltr" className="mx-3 my-3 rounded-2xl border border-sky-500/30 bg-[#101824] p-3 text-white sm:p-4" aria-label={'BetsAPI ' + mode + ' catalogue'}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold">BetsAPI · {mode === 'live' ? 'Live' : 'Upcoming'} games</h2>
        <p className="text-xs text-slate-400">Read-only source preview · not available for betting</p>
      </div>
      <Link className="rounded-lg bg-sky-700 px-3 py-2 text-sm hover:bg-sky-600" href="/betsapi">Inspect markets ↗</Link>
    </div>
    <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
      {SPORTS.map(item => <button key={item.id} type="button" onClick={() => { setSport(item.id); setPage(1); setValue(undefined); }} className={'shrink-0 rounded-lg border px-3 py-2 text-sm ' + (sport === item.id ? 'border-sky-400 bg-sky-800' : 'border-white/15 bg-white/5')}>{item.name}</button>)}
    </div>
    {loading && <p className="py-3 text-sm text-slate-300">Loading provider fixtures…</p>}
    {!loading && failure && <p role="alert" className="py-3 text-sm text-amber-300">{failure}</p>}
    {!loading && value?.error && <p role="alert" className="py-3 text-sm text-amber-300">Provider unavailable: {value.error}</p>}
    {!loading && value && !value.error && <>
      <p className="mb-3 text-sm text-slate-300">Provider reported: <strong>{value.total ?? 'unknown'}</strong> {mode} fixtures · Showing {visible.length} {mode === 'upcoming' ? 'on this page' : 'of the returned list'}</p>
      <div className="grid gap-2 md:grid-cols-2">
        {visible.map((match, index) => <div key={(match.fi ?? match.home + match.away) + '-' + index} className="rounded-xl border border-white/10 bg-[#192435] p-3">
          <p className="mb-1 truncate text-xs text-slate-400">{match.league}</p>
          <p className="text-sm font-semibold">{match.home} <span className="text-slate-400">vs</span> {match.away}</p>
          <p className="mt-1 text-xs text-slate-300">{mode === 'live' ? (match.score ?? 'Live · score unavailable') : (match.kickoff ? new Date(match.kickoff).toLocaleString() : 'Time unavailable')}</p>
        </div>)}
      </div>
      {visible.length === 0 && <p className="py-3 text-sm text-slate-300">No fixtures were returned for this sport.</p>}
      {mode === 'upcoming' && <div className="mt-3 flex items-center gap-3">
        <button className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p-1))}>Previous</button>
        <span className="text-sm">Page {page}{value.pageCount ? ' / ' + value.pageCount : ''}</span>
        <button className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40" disabled={!!value.pageCount && page >= value.pageCount || fixtures.length === 0} onClick={() => setPage(p => p+1)}>Next</button>
      </div>}
    </>}
  </section>;
}
