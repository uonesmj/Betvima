'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/hooks/useApi';
import { labelTier } from '@/providers/betsapi-label-quality';

type Mode = 'live' | 'upcoming';
interface Fixture {
  fi: string | null; eventId: string | null; sportId: number;
  home: string; away: string; league: string; country: string | null;
  kickoff: string | null; score: string | null; minute: number | null;
}
interface MatchList {
  readOnly: true; configured: boolean; mode: Mode; sportId: number;
  feed: 'bet365' | 'events';
  page: number; pageCount: number | null; total: number | null;
  refreshedAt: string; fixtures: Fixture[]; error: string | null;
}
interface Market {
  key: string; title: string;
  selections: Array<{ id: string; label: string; decimal: string }>;
}
interface MarketList {
  source: 'betsapi_bet365';
  readOnly: true; configured: boolean; mode: Mode; fi: string;
  refreshedAt: string; marketCount: number; selectionCount: number;
  markets: Market[]; error: string | null;
}
type ResponseData = MatchList | MarketList;
const SPORTS = [
  { id: 1, name: 'Football' }, { id: 18, name: 'Basketball' },
  { id: 13, name: 'Tennis' }, { id: 91, name: 'Volleyball' },
  { id: 17, name: 'Ice Hockey' }, { id: 3, name: 'Cricket' },
  { id: 78, name: 'Handball' }, { id: 16, name: 'Baseball' },
  { id: 12, name: 'American Football' }, { id: 92, name: 'Table Tennis' },
  { id: 15, name: 'Darts' }, { id: 14, name: 'Snooker' },
  { id: 83, name: 'Futsal' }, { id: 94, name: 'Badminton' },
  { id: 8, name: 'Rugby Union' }, { id: 19, name: 'Rugby League' },
  { id: 36, name: 'Australian Rules' }, { id: 90, name: 'Floorball' },
  { id: 95, name: 'Beach Volleyball' }, { id: 110, name: 'Water Polo' },
  { id: 107, name: 'Squash' }, { id: 151, name: 'E-sports' },
  { id: 162, name: 'MMA / UFC' }, { id: 9, name: 'Boxing' },
  { id: 2, name: 'Horse Racing' }, { id: 4, name: 'Greyhounds' },
  { id: 66, name: 'Bowls' }, { id: 75, name: 'Gaelic Sports' },
];
const time = (value: string | null): string => value
  ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Date unavailable';
const prettyError = (value: string | null) => ({
  NOT_CONFIGURED: 'BetsAPI is not configured on this server. An admin may enter the new token below to inspect data privately.',
  UPSTREAM_DENIED: 'BetsAPI rejected the token or the requested market family.',
  UPSTREAM_QUOTA: 'The trial request quota is exhausted. Wait for its reset.',
  UPSTREAM_TIMEOUT: 'BetsAPI did not answer within the request timeout.',
  UPSTREAM_UNAVAILABLE: 'BetsAPI is unavailable for this request.',
  UPSTREAM_INVALID: 'The bookmaker returned an invalid or oversized response.',
  INVALID_FILTER: 'Invalid filters.',
  FORBIDDEN_ORIGIN: 'The request was rejected by the same-origin protection.',
  NO_BET365_MARKETS: 'This Events API fixture is listed, but it has no linked Bet365 FI. No bookmaker market is available for this match.',
}[value ?? ''] ?? (value ?? ''));

export function BetsApiExplorer() {
  const deepLinkConsumed = useRef(false);
  const [mode, setMode] = useState<Mode>('live');
  const [feed, setFeed] = useState<'bet365' | 'events'>('bet365');
  const [sport, setSport] = useState(1);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState('');
  const [trialToken, setTrialToken] = useState('');
  const [activeToken, setActiveToken] = useState('');
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [chosen, setChosen] = useState<Fixture | null>(null);
  const [marketQuery, setMarketQuery] = useState('');
  const [marketPage, setMarketPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [list, setList] = useState<MatchList | null>(null);
  const [markets, setMarkets] = useState<MarketList | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [marketBusy, setMarketBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [previewSelections, setPreviewSelections] = useState<Array<{ fi: string; match: string; market: string; marketId: string; selection: string; selectionId: string; odds: string; mode: Mode; priceState: 'unchecked' | 'unchanged' | 'changed' | 'unavailable'; latestOdds: string | null }>>([]);
  const [recheckBusy, setRecheckBusy] = useState(false);
  const access = activeToken;
  const request = useCallback(async (params: {
    mode: Mode; sportId: number; feed?: 'bet365' | 'events';
    page?: number; day?: string; fi?: string;
  }): Promise<ResponseData> => {
    const url = '/api/v1/betsapi/explorer';
    if (access) {
      return apiRequest<ResponseData>(url, {
        method: 'POST', json: { ...params, token: access }, cache: 'no-store',
      });
    }
    const query = new URLSearchParams({
      mode: params.mode, sportId: String(params.sportId),
      feed: params.feed ?? 'bet365',
      page: String(params.page ?? 1),
    });
    if (params.fi) query.set('fi', params.fi);
    if (params.day) query.set('day', params.day);
    return apiRequest<ResponseData>(url + '?' + query, { cache: 'no-store' });
  }, [access]);

  const loadFixtures = useCallback(async () => {
    setListBusy(true);
    setFailure('');
    try {
      const data = await request({ mode, sportId: sport, feed, page,
        day: mode === 'upcoming' && date ? date.replaceAll('-', '') : undefined });
      if ('fixtures' in data) setList(data);
    } catch {
      setFailure('Cannot load sports catalogue. Please retry.');
    } finally { setListBusy(false); }
  }, [request, mode, sport, page, date, feed]);
  const loadMarkets = useCallback(async (fixture: Fixture) => {
    if (!fixture.fi) {
      setMarkets({
        source: 'betsapi_bet365', readOnly: true, configured: Boolean(access),
        mode, fi: '', refreshedAt: new Date().toISOString(),
        marketCount: 0, selectionCount: 0, markets: [], error: 'NO_BET365_MARKETS',
      });
      return;
    }
    setMarketBusy(true);
    try {
      const data = await request({ mode, sportId: sport, fi: fixture.fi });
      if ('markets' in data) setMarkets(data);
    } catch {
      setMarkets(null);
      setFailure('Unable to load market details.');
    } finally { setMarketBusy(false); }
  }, [request, mode, sport, access]);

  useEffect(() => { void loadFixtures(); }, [loadFixtures]);
  useEffect(() => {
    if (!autoRefresh || mode !== 'live') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadFixtures();
        if (chosen) void loadMarkets(chosen);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, mode, loadFixtures, loadMarkets, chosen]);

  useEffect(() => {
    if (deepLinkConsumed.current || !list || list.error || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fi = params.get('fi');
    if (!fi || !/^\d{1,16}$/.test(fi)) { deepLinkConsumed.current = true; return; }
    const item = list.fixtures.find(f => f.fi === fi);
    if (!item) return;
    deepLinkConsumed.current = true;
    setChosen(item);
    setMarkets(null);
    setMarketPage(1);
    void loadMarkets(item);
  }, [list, loadMarkets]);

  const displayed = useMemo(() => (list?.fixtures ?? []).filter(f => {
    const q = search.trim().toLowerCase();
    return (!q || [f.home, f.away, f.league].some(v => v.toLowerCase().includes(q))) &&
      (!country || f.country === country);
  }), [list, search, country]);
  const countryOptions = useMemo(() => [...new Set((list?.fixtures ?? [])
    .map(f => f.country).filter((c): c is string => Boolean(c)))].sort(), [list]);
  const visibleMarkets = useMemo(() => (markets?.markets ?? []).filter(m => {
    const q = marketQuery.trim().toLowerCase();
    return !q || m.title.toLowerCase().includes(q) ||
      m.selections.some(x => x.label.toLowerCase().includes(q));
  }), [markets, marketQuery]);
  const coverage = useMemo(() => {
    const all = (markets?.markets ?? []).flatMap(m => m.selections);
    const tiers = (markets?.markets ?? []).flatMap(m => m.selections.map(s => labelTier(s.label, m.title)));
    const valid = tiers.filter(t => t === 'named').length;
    const partial = tiers.filter(t => t === 'partial').length;
    const unresolved = tiers.filter(t => t === 'unresolved').length;
    return { total: all.length, valid, partial, unresolved };
  }, [markets]);
  const addPreview = (market: Market, selection: Market['selections'][number]) => {
    if (!chosen?.fi || !/^\d{1,16}$/.test(chosen.fi)) return;
    const item = { fi: chosen.fi, match: chosen.home + ' — ' + chosen.away,
      market: market.title, marketId: market.key, selection: selection.label,
      selectionId: selection.id, odds: selection.decimal, mode, priceState: 'unchecked' as const, latestOdds: null };
    setPreviewSelections(previous => [
      ...previous.filter(p => p.fi !== item.fi), item,
    ].slice(-20));
  };
  const recheckPreview = async () => {
    if (recheckBusy || !previewSelections.length) return;
    setRecheckBusy(true);
    try {
      const groups = [...new Map(previewSelections.map(p => [p.fi + ':' + p.mode, { fi: p.fi, mode: p.mode }])).values()];
      const snapshots = await Promise.all(groups.map(async group => {
        try {
          const result = await request({ mode: group.mode, sportId: sport, fi: group.fi });
          return { key: group.fi + ':' + group.mode, data: 'markets' in result && !result.error ? result : null };
        } catch { return { key: group.fi + ':' + group.mode, data: null }; }
      }));
      const byFixture = new Map(snapshots.map(s => [s.key, s.data]));
      setPreviewSelections(items => items.map(p => {
        const catalogue = byFixture.get(p.fi + ':' + p.mode);
        const market = catalogue?.markets.find(m => m.key === p.marketId);
        const fresh = market?.selections.find(s => s.id === p.selectionId)?.decimal ?? null;
        const valid = fresh !== null && /^\\d{1,4}(?:\\.\\d{1,4})?$/.test(fresh) && Number(fresh) > 1;
        return {...p, latestOdds: valid ? fresh : null,
          priceState: !valid ? 'unavailable' : Number(fresh) === Number(p.odds) ? 'unchanged' : 'changed'};
      }));
    } finally { setRecheckBusy(false); }
  };
  const selectedMarkets = visibleMarkets.slice((marketPage - 1) * 20, marketPage * 20);
  const button = 'rounded-xl border border-white/15 px-3 py-2 text-sm transition hover:border-sky-400';
  const setFilter = (nextMode: Mode, nextSport: number, nextPage = 1) => {
    setMode(nextMode); setSport(nextSport); setPage(nextPage);
    setList(null); setChosen(null); setMarkets(null); setMarketQuery(''); setMarketPage(1);
    setSearch(''); setCountry('');
  };

  return (
    <main className="min-h-screen bg-[#090c13] px-3 pb-24 pt-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#131924] p-5">
          <div>
            <p className="text-sm font-bold tracking-wide text-sky-400">BETVIMA · SPORTS DATA</p>
            <h1 className="mt-1 text-2xl font-bold">BetsAPI Games &amp; Markets</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              View source fixtures and all returned Bet365 markets. This inspection is read-only:
              selections are not linked to wallets, coupons or settlement.
            </p>
          </div>
          <Link href="/" className={button}>Back to BetVima sports</Link>
        </header>

        <section className="rounded-2xl border border-sky-800/40 bg-sky-950/30 p-4">
          <p className="text-sm text-sky-100">
            <strong>Preview source: BetsAPI / Bet365.</strong> Main-account wagering continues under the
            separately validated production feed. No prices from this page are executable bets.
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-sky-300">
              Admin: inspect with a new one-time BetsAPI token
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <input type="password" autoComplete="off" spellCheck={false} value={trialToken}
                onChange={e => setTrialToken(e.target.value)}
                placeholder="Rotated API token (kept only in this tab)"
                className="min-w-64 flex-1 rounded-xl border border-white/15 bg-[#101727] px-3 py-2 text-sm"
                aria-label="BetsAPI token" />
              <button className={button} type="button"
                onClick={() => { setActiveToken(trialToken.trim()); setChosen(null); setMarkets(null); }}>
                Load with admin token
              </button>
              {trialToken && <button type="button" className={button} onClick={() => {
                setTrialToken(''); setActiveToken(''); setMarkets(null);
              }}>Clear token</button>}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Admin authentication is required. The token is sent over HTTPS and is not
              saved in site storage or the app. Never use the old token shared in chat.
            </p>
          </details>
        </section>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-400">Match source:</span>
          <button type="button" className={button + (feed === 'bet365' ? ' border-sky-400 bg-blue-900/60' : '')}
            onClick={() => { setFeed('bet365'); setPage(1); setList(null); setChosen(null); setMarkets(null); }}>
            Bet365 · bookmaker fixtures
          </button>
          <button type="button" className={button + (feed === 'events' ? ' border-sky-400 bg-blue-900/60' : '')}
            onClick={() => { setFeed('events'); setPage(1); setList(null); setChosen(null); setMarkets(null); }}>
            All BetsAPI Events · including unpriced
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-xl bg-[#161e2b] p-1">
            {(['live', 'upcoming'] as const).map(value =>
              <button type="button" key={value} onClick={() => setFilter(value, sport)}
                className={'rounded-lg px-5 py-2 text-sm font-semibold ' +
                  (mode === value ? 'bg-blue-600 text-white' : 'text-slate-300')}>
                {value === 'live' ? 'Live' : 'Upcoming'}
              </button>)}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {list?.refreshedAt && <span>Checked {new Date(list.refreshedAt).toLocaleTimeString()}</span>}
            {mode === 'live' && <label className="flex items-center gap-1">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto refresh 30s
            </label>}
            <button type="button" onClick={() => { void loadFixtures(); if (chosen) void loadMarkets(chosen); }}
              disabled={listBusy} className={button}>{listBusy ? 'Loading…' : 'Refresh'}</button>
          </div>
        </div>

        {mode === 'upcoming' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#111721] px-4 py-3">
            <label className="text-sm text-slate-300" htmlFor="betsapi-upcoming-date">Upcoming UTC date</label>
            <input id="betsapi-upcoming-date" type="date" value={date}
              onChange={e => { setDate(e.target.value); setPage(1); setList(null); }}
              className="rounded-lg border border-white/15 bg-[#1a2330] px-3 py-2 text-sm text-white" />
            <button type="button" className={button}
              onClick={() => { setDate(''); setPage(1); setList(null); }}>All dates (first 100 pages)</button>
            <span className="text-xs text-slate-400">
              Pick a UTC day to browse distant fixtures beyond the upstream page-100 limit.
            </span>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2">
          {SPORTS.map(s => <button key={s.id} type="button" onClick={() => setFilter(mode, s.id)}
            className={'shrink-0 ' + button + (sport === s.id ? ' border-sky-400 bg-blue-600/30' : ' bg-[#172030]')}>
            {s.name}</button>)}
        </div>

        {failure && <p role="alert" className="rounded-xl bg-red-950/40 p-3 text-sm text-rose-300">{failure}</p>}
        {list?.error && <p role="status" className="rounded-xl border border-amber-900/50 bg-amber-950/40 p-3 text-sm text-amber-300">
          {prettyError(list.error)}
        </p>}

        <section aria-label="Bet365 read-only betslip" className="rounded-2xl border border-sky-800/40 bg-[#111a2b] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">Preview Bet Slip · {previewSelections.length} picks</h2>
            <div className="flex items-center gap-3">
              <button type="button" disabled={recheckBusy || !previewSelections.length}
                onClick={() => void recheckPreview()} className="text-xs text-sky-300 underline disabled:opacity-40">
                {recheckBusy ? 'Checking…' : 'Recheck source prices'}
              </button>
              <button type="button" onClick={() => setPreviewSelections([])}
                className="text-xs text-sky-300 underline">Clear</button>
            </div>
          </div>
          <p className="mt-1 text-xs text-amber-200">Inspection only — no stake, payout, wallet deduction or bet placement. Prices can change.</p>
          {previewSelections.length === 0
            ? <p className="mt-3 text-sm text-slate-400">Choose an outcome below to inspect a preview selection.</p>
            : <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {previewSelections.map(p => (
                  <div key={p.fi} className="rounded-lg border border-white/10 bg-[#192437] p-3 text-xs">
                    <p className="font-semibold">{p.match}</p>
                    <p className="mt-1 text-slate-300">{p.market} · {p.selection}</p>
                    <p role="status" className={p.priceState === 'changed' || p.priceState === 'unavailable' ? 'mt-1 text-amber-300' : 'mt-1 text-slate-400'}>
                      {p.priceState === 'unchecked' ? 'Not rechecked' :
                        p.priceState === 'unavailable' ? 'Outcome no longer available — preview only' :
                        p.priceState === 'changed' ? 'Price changed to ' + p.latestOdds + ' — requires acceptance in a future real quote' :
                        'Same reference price on latest snapshot'}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <strong className="text-sky-300">{p.odds}</strong>
                      <button type="button" className="text-rose-300 underline"
                        onClick={() => setPreviewSelections(items => items.filter(x => x.fi !== p.fi))}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>}
        </section>
        <div className="grid gap-4 lg:grid-cols-[minmax(310px,4fr)_minmax(390px,5fr)]">
          <section className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-[#111721] p-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="font-bold">Matches</h2>
              <span className="text-xs text-slate-400">
                {list?.total ?? displayed.length} {mode === 'live' ? 'live' : 'upcoming'} ·
                {' '}{displayed.length} shown on this page
              </span>
            </div>
            <div className="flex gap-2">
              <input type="search" placeholder="Search team or league…" aria-label="Search fixtures"
                value={search} onChange={e => setSearch(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1a2330] px-3 py-2 text-sm" />
              <select aria-label="Filter country" value={country} onChange={e => setCountry(e.target.value)}
                className="max-w-28 rounded-xl border border-white/10 bg-[#1a2330] px-2 text-xs">
                <option value="">All countries</option>
                {countryOptions.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
            {listBusy && !list && <p className="p-6 text-center text-slate-400">Loading source matches…</p>}
            {!listBusy && list && !list.error && !displayed.length &&
              <p className="p-6 text-center text-sm text-slate-400">No matches for these filters.</p>}
            <div className="max-h-[70vh] space-y-2 overflow-y-auto">
              {displayed.map(f => (
                <button type="button" key={f.fi} onClick={() => {
                  setChosen(f); setMarkets(null); setMarketQuery(''); setMarketPage(1); void loadMarkets(f);
                }} className={'w-full rounded-xl border p-3 text-left transition hover:border-sky-500 ' +
                  (chosen?.fi === f.fi ? 'border-sky-500 bg-blue-950/40' : 'border-white/10 bg-[#1b2431]')}>
                  <div className="flex justify-between gap-2 text-xs text-slate-400">
                    <span className="truncate">{f.league}{f.country ? ' · ' + f.country.toUpperCase() : ''}</span>
                    <span className="shrink-0">{mode === 'live'
                      ? (f.minute !== null ? f.minute + '′' : 'LIVE')
                      : time(f.kickoff)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>{f.home} — {f.away}</span>
                    <span className="shrink-0 font-bold text-emerald-400">{f.score ?? '›'}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{f.fi ? 'Bet365 FI ' + f.fi + ' · View available markets ›' : 'Events API fixture · No linked Bet365 prices'}</p>
                </button>
              ))}
            </div>
            {mode === 'upcoming' && list && (
              <div className="flex items-center justify-between gap-3 pt-2 text-sm">
                <button className={button} type="button" disabled={page <= 1}
                  onClick={() => setFilter(mode, sport, page - 1)}>Previous</button>
                <span>Page {page}{list.pageCount ? ' / ' + list.pageCount : ''}</span>
                <button className={button} type="button"
                  disabled={!list.fixtures.length || (list.pageCount !== null && page >= list.pageCount)}
                  onClick={() => setFilter(mode, sport, page + 1)}>Next</button>
              </div>
            )}
          </section>

          <section className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-[#111721] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{chosen ? chosen.home + ' vs ' + chosen.away : 'All Bet365 markets'}</h2>
              {markets && <span className="text-xs text-slate-400">
                {markets.marketCount} markets · {markets.selectionCount} prices
              </span>}
            </div>
            {!chosen && <p className="py-20 text-center text-sm text-slate-400">
              Select a match to inspect its available betting markets and bookmaker prices.
            </p>}
            {marketBusy && <p className="p-5 text-sm text-sky-300">Loading bookmaker markets…</p>}
            {markets?.error && <p className="rounded-lg bg-amber-950/30 p-3 text-sm text-amber-200">
              {prettyError(markets.error)}
            </p>}
            {markets && !markets.error && (
              <>
                <div className="flex gap-2">
                  <input type="search" value={marketQuery} onChange={e => {
                    setMarketQuery(e.target.value); setMarketPage(1);
                  }} placeholder="Search markets and outcomes…"
                    className="w-full rounded-xl border border-white/10 bg-[#1a2330] px-3 py-2 text-sm" />
                  <button type="button" className={button} onClick={() => chosen && void loadMarkets(chosen)}
                    disabled={marketBusy}>Update</button>
                </div>
                <div role="status" className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[#161e2b] p-3 text-xs sm:grid-cols-5">
                  <div><span className="block text-slate-400">Market groups</span><strong>{markets.marketCount}</strong></div>
                  <div><span className="block text-slate-400">Priced outcomes</span><strong>{coverage.total}</strong></div>
                  <div><span className="block text-slate-400">Explicitly named</span><strong>{coverage.valid}</strong></div>
                  <div><span className="block text-slate-400">Partial context</span><strong className="text-amber-300">{coverage.partial}</strong></div>
                   <div><span className="block text-slate-400">Unresolved identity</span><strong className={coverage.unresolved ? 'text-rose-300' : 'text-emerald-300'}>{coverage.unresolved}</strong></div>
                  <p className="col-span-2 text-slate-400 sm:col-span-5">Diagnostic counts for this selected fixture only, not guaranteed executable markets. Last snapshot: {time(markets.refreshedAt)}.</p>
                </div>
                {(coverage.partial + coverage.unresolved) > 0 && (
                  <p role="status" className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
                    Partial context means a line or side can be read, but the source outcome name is still missing. Unresolved means identity cannot be established. Neither category is validated for wagering or settlement.
                  </p>
                )}
                {!visibleMarkets.length && <p className="p-5 text-sm text-slate-400">
                  No currently priced markets returned by this request.
                </p>}
                <div className="max-h-[75vh] space-y-3 overflow-y-auto">
                  {selectedMarkets.map((market, index) => (
                    <div key={market.key + index} className="rounded-xl border border-white/10 bg-[#1b2431] p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold">{market.title}</h3>
                        <span className="text-xs text-slate-300">
                          <span className="text-emerald-300">{market.selections.filter(s => labelTier(s.label, market.title) === 'named').length} named</span>
                          {' · '}<span className="text-amber-300">{market.selections.filter(s => labelTier(s.label, market.title) === 'partial').length} partial</span>
                          {' · '}<span className="text-rose-300">{market.selections.filter(s => labelTier(s.label, market.title) === 'unresolved').length} unresolved</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {market.selections.map(selection => (
                          <button type="button" key={selection.id} title="Add to read-only preview slip" onClick={() => addPreview(market, selection)}
                            className="flex items-center justify-between gap-2 rounded-lg bg-[#253247] px-3 py-3 text-left text-xs transition hover:bg-[#304866] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
                            <span className="min-w-0 break-words text-slate-200">{selection.label}</span>
                            <strong className="shrink-0 text-sky-300">{selection.decimal}</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {visibleMarkets.length > 20 && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button type="button" className={button} disabled={marketPage <= 1}
                      onClick={() => setMarketPage(m => m - 1)}>Previous markets</button>
                    <span>{marketPage} / {Math.ceil(visibleMarkets.length / 20)}</span>
                    <button type="button" className={button}
                      disabled={marketPage * 20 >= visibleMarkets.length}
                      onClick={() => setMarketPage(m => m + 1)}>Next markets</button>
                  </div>
                )}
                <p className="text-xs text-slate-500">Reference snapshot: {time(markets.refreshedAt)}.
                  A returned price is not a guaranteed executable offer; source status and
                  current odds must be revalidated before any future financial cutover.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
