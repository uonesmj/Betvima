'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Radio, Search, X } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { MatchCard, type MarketView, type MatchView } from '@/components/betting/match-card';

type SearchMatch = {
  id: string; leagueId?: string | null; leagueName?: string | null;
  leagueLogoUrl?: string | null; countryCode?: string | null; sportKey?: string;
  status?: string; scheduledAt?: string; startTime?: string;
  minute?: number | null; period?: string | null;
  homeScore?: number | null; awayScore?: number | null;
  isLive?: boolean; isBettingAvailable?: boolean; marketsCount?: number;
  participants?: Array<{ teamId?: string; role?: string; name?: string; logoUrl?: string | null; imageUrl?: string | null }>;
  homeTeamName?: string; awayTeamName?: string;
  topMarkets?: unknown[]; markets?: unknown[];
};

type ResultSet = { live: MatchView[]; upcoming: MatchView[]; failed: boolean };

function validMarket(raw: unknown): MarketView | null {
  if (!raw || typeof raw !== 'object') return null;
  const market = raw as Record<string, unknown>;
  if (!Array.isArray(market.selections)) return null;
  return {
    id: String(market.id ?? ''), key: String(market.key ?? ''),
    name: String(market.name ?? market.nameEn ?? market.nameFa ?? ''),
    status: String(market.status ?? 'closed').toLowerCase() === 'active' ? 'open' : String(market.status ?? 'closed').toLowerCase(),
    selections: market.selections.map((value: unknown) => {
      const v = (value ?? {}) as Record<string, unknown>;
      return {
        id: String(v.id ?? ''), code: String(v.code ?? ''),
        name: String(v.name ?? v.nameEn ?? v.nameFa ?? ''),
        oddsScaled: String(v.oddsScaled ?? '0'),
        previousOddsScaled: v.previousOddsScaled == null ? null : String(v.previousOddsScaled),
        status: String(v.status ?? 'closed').toLowerCase() === 'active' ? 'open' : String(v.status ?? 'closed').toLowerCase(),
        oddsVersion: Number(v.oddsVersion ?? 0),
        movement: v.movement === 'UP' || v.movement === 'DOWN' ? v.movement : 'STABLE',
      };
    }),
  };
}

function toMatchView(raw: SearchMatch): MatchView {
  const live = raw.isLive === true || ['live', 'in_play', 'inplay'].includes(String(raw.status).toLowerCase());
  const members = Array.isArray(raw.participants) ? raw.participants : [];
  const participants = members.length
    ? members.map(p => ({
        teamId: p.teamId ?? '', role: String(p.role ?? '').toUpperCase(),
        name: p.name ?? '', logoUrl: p.logoUrl ?? p.imageUrl ?? null,
      }))
    : [
        { teamId: '', role: 'HOME', name: raw.homeTeamName ?? '', logoUrl: null },
        { teamId: '', role: 'AWAY', name: raw.awayTeamName ?? '', logoUrl: null },
      ];
  const topMarkets = (Array.isArray(raw.topMarkets) && raw.topMarkets.length
    ? raw.topMarkets : Array.isArray(raw.markets) ? raw.markets : [])
    .map(validMarket).filter((market): market is MarketView => market !== null);
  return {
    id: raw.id, sportKey: raw.sportKey ?? 'football',
    leagueId: raw.leagueId ?? null, leagueName: raw.leagueName ?? null,
    leagueLogoUrl: raw.leagueLogoUrl ?? null, countryCode: raw.countryCode ?? null,
    status: raw.status ?? 'scheduled', scheduledAt: raw.scheduledAt ?? raw.startTime ?? '',
    minute: raw.minute ?? null, period: raw.period ?? null, homeScore: raw.homeScore ?? null,
    awayScore: raw.awayScore ?? null, participants, isLive: live,
    isBettingAvailable: raw.isBettingAvailable === true,
    marketsCount: raw.marketsCount ?? topMarkets.length, topMarkets,
  };
}

function SearchFixture({ match }: { match: MatchView }) {
  return (
    <div data-testid="search-fixture" data-live={match.isLive}>
      <MatchCard match={match} />
    </div>
  );
}

async function findMatches(term: string, live: boolean, signal: AbortSignal): Promise<MatchView[]> {
  const url = `/api/v1/matches?live=${live}&page=1&pageSize=50&q=${encodeURIComponent(term)}`;
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  const json = await response.json();
  const values = json?.data?.items ?? json?.items;
  if (!Array.isArray(values)) throw new Error('Invalid matches payload');
  return values.filter((item: unknown): item is SearchMatch => Boolean(
    item && typeof item === 'object' && typeof (item as SearchMatch).id === 'string',
  )).map(toMatchView);
}

function SearchPageContent() {
  const { locale, session } = useApp();
  const fa = locale === 'fa';
  const params = useSearchParams();
  const initial = params.get('searchQuery') ?? '';
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<ResultSet>({ live: [], upcoming: [], failed: false });
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setQuery(initial); }, [initial]);
  useEffect(() => {
    const term = query.trim();
    const url = new URL(window.location.href);
    if (term) url.searchParams.set('searchQuery', term);
    else url.searchParams.delete('searchQuery');
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
    if (term.length < 2) {
      setLoading(false);
      setResults({ live: [], upcoming: [], failed: false });
      return;
    }
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const [live, upcoming] = await Promise.allSettled([
        findMatches(term, true, abort.signal), findMatches(term, false, abort.signal),
      ]);
      if (abort.signal.aborted) return;
      setResults({
        live: live.status === 'fulfilled' ? live.value : [],
        upcoming: upcoming.status === 'fulfilled' ? upcoming.value : [],
        failed: live.status === 'rejected' || upcoming.status === 'rejected',
      });
      setLoading(false);
    }, 320);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [query]);
  const counts = useMemo(() => ({
    live: results.live.length, upcoming: results.upcoming.length,
  }), [results]);

  return (
    <main dir="ltr" className="min-h-screen bg-[#E9EAEF] pb-28 text-[#22242A]">
      <header className="flex h-[82px] items-center justify-between gap-3 bg-[#121212] px-4">
        <Link href="/" className="shrink-0 text-xl font-black tracking-tight text-white">
          BET<span className="text-[#04C960]">VIMA</span>
        </Link>
        <div className="flex items-center gap-2">
          {session?.authenticated ? (
            <Link href="/wallet" className="rounded-xl bg-[#05C466] px-4 py-3 text-sm font-bold text-white">
              {fa ? 'کیف پول' : 'Deposit'}
            </Link>
          ) : <>
            <Link href="/auth/login" className="rounded-xl bg-[#2C2C2D] px-3.5 py-3 text-sm font-semibold text-white">Login</Link>
            <Link href="/auth/register" className="rounded-xl bg-[#05C466] px-3.5 py-3 text-sm font-bold text-white">Registration</Link>
          </>}
        </div>
      </header>
      <section className="mx-auto w-full max-w-[900px] px-4 pt-7">
        <div className="relative mb-7 flex h-8 items-center justify-center">
          <Link href="/" aria-label={fa ? 'بازگشت' : 'Back'} className="absolute left-0 p-1">
            <ArrowLeft size={22}/>
          </Link>
          <div className="flex items-center gap-2 text-lg font-bold">
            <Search size={21} className="text-[#545A65]"/>{fa ? 'جست‌وجو' : 'Search'}
          </div>
        </div>
        <form onSubmit={e => { e.preventDefault(); input.current?.blur(); }} role="search">
          <div className="mb-6 flex h-[61px] items-center gap-3 rounded-[16px] border border-[#278CE8] bg-[#DDE0E7] px-4">
            <Search size={22} className="shrink-0 text-[#848B9A]"/>
            <input ref={input} value={query} onChange={e => setQuery(e.target.value.slice(0, 80))}
              autoFocus autoComplete="off" spellCheck={false}
              placeholder={fa ? 'نام تیم، لیگ یا مسابقه' : 'Team, league or match'}
              aria-label={fa ? 'جست‌وجوی مسابقات' : 'Search matches'}
              className="h-full min-w-0 flex-1 bg-transparent text-base text-[#252832] outline-none placeholder:text-[#8E94A0]"/>
            {query ? <button type="button" onClick={() => { setQuery(''); input.current?.focus(); }}
              className="grid size-6 shrink-0 place-items-center rounded-full bg-[#8F97A5] text-white"
              aria-label={fa ? 'پاک کردن' : 'Clear'}><X size={14}/></button> : null}
          </div>
        </form>
        {query.trim().length < 2 ? (
          <p className="py-12 text-center text-[#707782]">{fa ? 'حداقل دو حرف برای جست‌وجو وارد کنید.' : 'Enter at least two characters to search matches.'}</p>
        ) : <>
          {results.failed && !loading && <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
            {fa ? 'بخشی از نتایج موقتاً بارگذاری نشد. دوباره تلاش کنید.' : 'Some search results could not be loaded. Please try again.'}
          </div>}
          {loading && <div role="status" className="py-5 text-sm text-[#777B87]">{fa ? 'در حال جست‌وجو…' : 'Searching…'}</div>}
          {!loading && counts.live + counts.upcoming === 0 && !results.failed ? (
            <div className="rounded-2xl bg-white px-5 py-12 text-center">
              {fa ? 'مسابقه‌ای پیدا نشد.' : 'No matches found.'}
            </div>
          ) : null}
          <div className="space-y-7" aria-busy={loading}>
            {results.live.length > 0 && <section aria-label={fa ? 'زنده' : 'Live'}>
              <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold">
                <span className="grid size-8 place-items-center rounded-lg bg-[#F50070]"><Radio size={19} color="white"/></span>
                {fa ? 'زنده' : 'Live'}
                <span className="text-xs text-[#969BA6]">{counts.live}</span>
              </h2>
              <div className="space-y-3">{results.live.map(match => <SearchFixture key={match.id} match={match}/>)}</div>
            </section>}
            {results.upcoming.length > 0 && <section aria-label={fa ? 'آینده' : 'Upcoming'}>
              <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold">
                <span className="grid size-8 place-items-center rounded-lg bg-[#08BE6C]"><CalendarDays size={19} color="white"/></span>
                {fa ? 'بازی‌های آینده' : 'Upcoming'}
                <span className="text-xs text-[#969BA6]">{counts.upcoming}</span>
              </h2>
              <div className="space-y-3">{results.upcoming.map(match => <SearchFixture key={match.id} match={match}/>)}</div>
            </section>}
          </div>
        </>}
      </section>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[66px] items-center justify-around border-t border-[#323236] bg-[#141416] pb-[env(safe-area-inset-bottom)] text-[#B7BBC7]">
        <Link href="/" className="text-xs">{fa ? 'خانه' : 'Home'}</Link>
        <Link href="/sports/football" className="text-xs">{fa ? 'ورزش‌ها' : 'Sports'}</Link>
        <Link href="/bets" className="text-xs">{fa ? 'شرط‌های من' : 'My Bets'}</Link>
        <Link href="/wallet" className="text-xs">{fa ? 'کیف پول' : 'Wallet'}</Link>
      </nav>
    </main>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#E9EAEF]"/>}><SearchPageContent/></Suspense>;
}
