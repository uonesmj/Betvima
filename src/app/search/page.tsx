'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, ChevronRight, Flame, LockKeyhole, Radio, Search, Tv, X } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { TeamLogo } from '@/components/ui/logo';
import { primaryBettingMarket } from '@/lib/primary-betting-market';
import { formatOddsScaled } from '@/lib/i18n';
import { useBetSlip, type SlipItem } from '@/lib/store/betslip';
import { type MarketView, type MatchView } from '@/components/betting/match-card';

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
    status: String(market.status ?? 'closed').toLowerCase(),
    selections: market.selections.map((value: unknown) => {
      const v = (value ?? {}) as Record<string, unknown>;
      return {
        id: String(v.id ?? ''), code: String(v.code ?? ''),
        name: String(v.name ?? v.nameEn ?? v.nameFa ?? ''),
        oddsScaled: String(v.oddsScaled ?? '0'),
        previousOddsScaled: v.previousOddsScaled == null ? null : String(v.previousOddsScaled),
        status: String(v.status ?? 'closed').toLowerCase(),
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

function searchLabel(match: MatchView, fa: boolean) {
  const sport = match.sportKey.replaceAll('-', ' ');
  if (!fa) return sport ? sport[0]?.toUpperCase() + sport.slice(1) : '';
  return ({ football: 'فوتبال', basketball: 'بسکتبال', hockey: 'هاکی روی یخ',
    tennis: 'تنیس', baseball: 'بیسبال' } as Record<string, string>)[match.sportKey] ?? sport;
}

function gameDate(s: string, locale: string) {
  const date = new Date(s);
  if (!s || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date).replace(',', ' •');
}

function countryFlag(code: string | null) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '🌐';
  const upper = code.toUpperCase();
  return String.fromCodePoint(...Array.from(upper).map(char => char.charCodeAt(0) + 127397));
}

function SearchOdds({ match, market, selection, index }: {
  match: MatchView; market: MarketView; selection: MarketView['selections'][number]; index: number
}) {
  const { locale } = useApp();
  const selected = useBetSlip(s => s.items.some(item => item.selectionId === selection.id));
  const toggle = useBetSlip(s => s.toggle);
  const locked = !match.isBettingAvailable || market.status !== 'open' ||
    selection.status !== 'open' || !/^\d+$/.test(selection.oddsScaled) ||
    Number(selection.oddsScaled) <= 10000;
  const label = market.key === 'h2h' && market.selections.length >= 3
    ? ['1', 'X', '2'][index] : selection.name;
  const item: SlipItem = {
    selectionId: selection.id, marketId: market.id, matchId: match.id,
    label: selection.name, marketLabel: market.name,
    matchLabel: match.participants.map(p => p.name).join(' - '),
    sportSlug: match.sportKey, oddsScaled: selection.oddsScaled,
    oddsVersionSeen: selection.oddsVersion, addedAt: Date.now(),
  };
  return (
    <button type="button" disabled={locked} aria-pressed={selected}
      aria-label={`${label} ${locked ? 'unavailable' : formatOddsScaled(selection.oddsScaled)}`}
      onClick={() => toggle(item)}
      className={`flex h-[46px] min-w-0 items-center justify-between gap-1 rounded-[7px] px-2.5 transition-colors ${selected
        ? 'bg-[#DCEAFB] ring-1 ring-[#1889F5]' : 'bg-[#F0F1F5]'} ${locked ? 'cursor-not-allowed opacity-65' : 'active:bg-[#D8E7F8]'}`}>
      <span className="truncate text-[11px] font-medium text-[#50545C]">{label}</span>
      {locked ? <LockKeyhole size={15} className="shrink-0 text-[#A6ABB4]" /> :
        <strong className="tabular-nums text-sm font-bold text-[#24262C]">{formatOddsScaled(selection.oddsScaled)}</strong>}
    </button>
  );
}

function SearchFixture({ match }: { match: MatchView }) {
  const { locale } = useApp();
  const fa = locale === 'fa';
  const home = match.participants.find(p => p.role === 'HOME') ?? match.participants[0];
  const away = match.participants.find(p => p.role === 'AWAY') ?? match.participants[1];
  const market = primaryBettingMarket(match.topMarkets, match.isLive);
  const badge = match.isLive ? <Radio size={17} className="text-[#EE0065]" /> :
    <Flame size={17} className="text-[#F45117]" />;
  return (
    <article className="overflow-hidden rounded-[20px] bg-white text-[#24262C]" data-testid="search-fixture" data-live={match.isLive}>
      <Link href={`/match/${match.id}`} className="flex items-center gap-2.5 border-b border-[#E3E5EB] px-4 py-3.5">
        <span className="flex shrink-0 items-center gap-0.5 text-xl">{countryFlag(match.countryCode)}</span>
        <TeamLogo url={match.leagueLogoUrl} name={match.leagueName ?? ''} size={30}/>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-extrabold">{match.leagueName ?? 'Competition'}</strong>
          <span className="block text-xs text-[#696C75]">{searchLabel(match, fa)}</span>
        </span>
      </Link>
      <div className="px-4 pb-3.5 pt-3">
        <Link href={`/match/${match.id}`} className="mb-3 flex items-center gap-2">
          {badge}
          <span className="rounded-full border border-[#E4E5EC] px-2 py-1 text-[11px] font-semibold">
            {match.isLive
              ? `${match.period ?? (fa ? 'زنده' : 'Live')}${match.minute == null ? '' : ` ${match.minute}′`}`
              : gameDate(match.scheduledAt, locale)}
          </span>
          {match.isLive ? <span className="inline-flex items-center gap-1 rounded-full border border-[#E4E5EC] px-2 py-1 text-[10px] font-semibold text-[#747A85]"><Tv size={12} /> LIVE</span> : null}
        </Link>
        <Link href={`/match/${match.id}`} className="mb-3 block space-y-2">
          {([home, away] as const).map((team, i) => (
            <div className="flex items-center gap-2" key={i}>
              <TeamLogo url={team?.logoUrl} name={team?.name ?? 'TBD'} size={23} />
              <strong className="min-w-0 flex-1 truncate text-[13px] font-bold">{team?.name || 'TBD'}</strong>
              {match.isLive && (i === 0 ? match.homeScore : match.awayScore) != null ? (
                <span className="grid min-w-6 place-items-center rounded-md bg-[#EEF0F4] px-1 py-0.5 text-xs font-bold tabular-nums">
                  {i === 0 ? match.homeScore : match.awayScore}
                </span>
              ) : null}
            </div>
          ))}
        </Link>
        <div className="mb-2 truncate text-xs text-[#777C87]">
          {market?.name ?? (fa ? 'ضرایب در دسترس نیست' : 'Odds unavailable')}
        </div>
        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_48px] gap-1.5">
          {market ? Array.from({ length: 3 }, (_, index) => {
            const selection = market.selections[index];
            return selection ? <SearchOdds key={selection.id} match={match} market={market} selection={selection} index={index}/> :
              <span key={index} className="rounded-[7px] bg-[#F0F1F5]" />;
          }) : <div className="col-span-3 flex h-[46px] items-center justify-center rounded-[7px] bg-[#F0F1F5] text-xs text-[#818694]">
            {fa ? 'بازار فعال موجود نیست' : 'No open market'}
          </div>}
          <Link href={`/match/${match.id}`} aria-label={fa ? 'تمام مارکت‌ها' : 'All markets'}
            className="flex h-[46px] items-center justify-center rounded-[9px] bg-[#F0F1F5] text-xs font-extrabold text-[#272931]">
            {match.marketsCount ? `+${match.marketsCount}` : <ChevronRight size={19}/>}
          </Link>
        </div>
      </div>
    </article>
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
