'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatBetsApiOdds } from '@/lib/betsapi-odds-display';
import { sportByKey } from '@/lib/betsapi-sports-map';
import Link from 'next/link';
import { useApp } from '@/components/layout/providers';
import { TeamLogo, LeagueLogo } from '@/components/ui/logo';
import type { MatchView } from '@/components/betting/match-card';
import { CalendarDays, ChevronLeft, Radio, Search } from 'lucide-react';

type Market = { key: string; title: string; selections: { id: string; label: string; decimal: string }[] };
type Group = 'all' | 'main' | 'goals' | 'corners' | 'cards' | 'players' | 'other';
const GROUPS: { id: Group; en: string; fa: string }[] = [
  { id: 'all', en: 'All markets', fa: 'همه مارکت‌ها' },
  { id: 'main', en: 'Main', fa: 'اصلی' },
  { id: 'goals', en: 'Goals / Totals', fa: 'گل‌ها / مجموع' },
  { id: 'corners', en: 'Corners', fa: 'کرنرها' },
  { id: 'cards', en: 'Cards', fa: 'کارت‌ها' },
  { id: 'players', en: 'Players', fa: 'بازیکنان' },
  { id: 'other', en: 'Others', fa: 'سایر' },
];
function groupOf(title: string): Group {
  const t = title.toLowerCase();
  if (/corner/.test(t)) return 'corners';
  if (/card|booking|yellow|red card/.test(t)) return 'cards';
  if (/player|goalscorer|assist|shots on target/.test(t)) return 'players';
  if (/goal|over.?under|total|both teams to score|btts|points/.test(t)) return 'goals';
  if (/result|winner|double chance|moneyline|handicap|spread|draw no bet|1x2|qualification/.test(t)) return 'main';
  return 'other';
}
const usable = (label: string) => Boolean(label.trim()) && !/Unlabelled outcome/i.test(label);

/** Long scorelines and player markets remain accessible without filling dozens of mobile screens. */
function MarketSection({ market, isFa }: { market: Market; isFa: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? market.selections : market.selections.slice(0, 9);
  const remaining = market.selections.length - shown.length;
  return <section className="overflow-hidden rounded-xl border border-[#DDE5ED] bg-white shadow-[0_2px_10px_rgba(18,35,51,.03)]">
    <div className="border-b border-[#EDF0F3] px-3.5 py-3">
      <h3 className="text-sm font-extrabold text-[#263345]">{market.title}</h3>
    </div>
    <div className={`grid gap-1.5 p-2.5 ${market.selections.length < 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {shown.map((s, index) => <div key={s.id + ':' + index} aria-disabled="true" title={s.label}
        className="flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-[#E5EAF0] bg-[#F6F8FB] px-1.5 py-2 text-center">
        <span className="line-clamp-2 text-[10px] font-semibold leading-4 text-[#6D7B89]">{s.label}</span>
        <strong className="text-[13px] font-black tabular-nums text-[#243547]">{formatBetsApiOdds(s.decimal)}</strong>
      </div>)}
    </div>
    {market.selections.length > 9 && <button type="button"
      aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}
      className="w-full border-t border-[#EDF0F3] bg-[#F8FAFC] px-3 py-2 text-center text-[11px] font-extrabold text-[#087FF5]">
      {expanded
        ? (isFa ? 'نمایش گزینه‌های کمتر' : 'Show fewer selections')
        : (isFa ? `نمایش ${remaining} گزینه بیشتر` : `Show ${remaining} more selections`)}
    </button>}
  </section>;
}

function marketOrder(market: Market): number {
  const title = market.title.toLowerCase().trim();
  if (/^(?:full ?time result|match result|ft result|1x2|match winner)$/.test(title)) return 0;
  if (/^(?:double chance|both teams to score|btts|draw no bet|match betting|winner)$/.test(title)) return 1;
  if (/^(?:match goals|total goals|goals over\/under|goals over under|total points|goal line)$/.test(title)) return 2;
  if (/correct score|final score/.test(title)) return 8;
  const group = groupOf(title);
  return ({ main: 3, goals: 4, corners: 5, cards: 6, players: 7, other: 9, all: 10 } as Record<Group, number>)[group];
}

export function BetsApiEventMarkets({
  fi, mode, sportKey, fixture, markets, error, reportedCount,
}: {
  fi: string;
  mode: 'live' | 'upcoming';
  sportKey: string;
  fixture: MatchView | null;
  markets: Market[];
  error: string | null;
  reportedCount: number;
}) {
  const { locale } = useApp();
  const isFa = locale === 'fa';
  const [group, setGroup] = useState<Group>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(40);
  const [activeMarkets, setActiveMarkets] = useState<Market[]>(markets);
  const [feedError, setFeedError] = useState<string | null>(error);
  const [lastChanged, setLastChanged] = useState<string | null>(null);
  const [snapshotCount, setSnapshotCount] = useState(reportedCount);
  useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;
    let inflight = false;
    const update = async () => {
      if (cancelled || inflight || document.visibilityState !== 'visible' || !navigator.onLine) return;
      inflight = true;
      try {
        const sportId = sportByKey(sportKey)?.id;
        if (!sportId) return;
        const q = new URLSearchParams({ fi, mode, sportId: String(sportId) });
        const response = await fetch('/api/v1/betsapi/market-refresh?' + q, { cache: 'no-store' });
        if (!response.ok) throw new Error('NETWORK');
        const wrapper = await response.json() as { ok: boolean; data?: {
          markets: Market[]; marketCount: number; error: string | null;
        } };
        const incoming = wrapper.data;
        if (cancelled || !wrapper.ok || !incoming) return;
        if (incoming.error) { setFeedError(incoming.error); return; }
        setFeedError(null);
        setSnapshotCount(incoming.marketCount);
        setActiveMarkets(previous => {
          if (JSON.stringify(previous) !== JSON.stringify(incoming.markets)) {
            setLastChanged(new Date().toLocaleTimeString());
            return incoming.markets;
          }
          return previous;
        });
      } catch { if (!cancelled) setFeedError('REFRESH_UNAVAILABLE'); }
      finally { inflight = false; }
    };
    const timer = window.setInterval(() => { void update(); }, 10_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void update(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [mode, sportKey, fi]);

  const backHref = mode === 'live' ? '/live?sport=' + encodeURIComponent(sportKey) : '/sports/' + encodeURIComponent(sportKey);
  const home = fixture?.participants.find(p => p.role === 'HOME')?.name;
  const away = fixture?.participants.find(p => p.role === 'AWAY')?.name;
  const homeScore = fixture?.homeScore, awayScore = fixture?.awayScore;
  const validMarkets = useMemo(() => activeMarkets.map(m => ({
    ...m, selections: m.selections.filter(s => usable(s.label)),
  })).filter(m => m.selections.length > 0).sort((a,b) => marketOrder(a) - marketOrder(b)), [activeMarkets]);
  const filtered = useMemo(() => validMarkets.filter(m =>
    (group === 'all' || groupOf(m.title) === group) &&
    (!search.trim() || m.title.toLowerCase().includes(search.trim().toLowerCase())
      || m.selections.some(s => s.label.toLowerCase().includes(search.trim().toLowerCase())))
  ), [validMarkets, group, search]);
  const categories = GROUPS.filter(g => g.id === 'all' ||
    validMarkets.some(m => groupOf(m.title) === g.id));

  return <main className="mx-auto w-full max-w-[1160px] space-y-4 px-3 pb-28 pt-4">
    <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#087FF5]">
      <ChevronLeft size={17} /> {isFa ? 'بازگشت به مسابقات' : 'Back to matches'}
    </Link>
    <section className="overflow-hidden rounded-2xl border border-[#DDE5EE] bg-white shadow-[0_4px_18px_rgba(18,35,51,.055)]">
      <header className="flex items-center justify-between gap-3 border-b border-[#E5EBF0] bg-gradient-to-r from-[#F0F7FC] to-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <LeagueLogo url={fixture?.leagueLogoUrl ?? null} name={fixture?.leagueName ?? sportKey} sportKey={sportKey} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-[#253345]">{fixture?.leagueName ?? (isFa ? 'جزئیات مسابقه' : 'Match details')}</p>
            <p className="text-[11px] font-medium text-[#738293]">{sportKey.replaceAll('-', ' ')} · Bet365</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black ${mode === 'live' ? 'bg-[#FFE9F1] text-[#CB2161]' : 'bg-[#E8F6ED] text-[#078554]'}`}>
          {mode === 'live' ? <Radio size={13} /> : <CalendarDays size={13} />}
          {mode === 'live' ? (isFa ? 'زنده' : 'LIVE') : (isFa ? 'آینده' : 'UPCOMING')}
          {mode === 'live' && fixture?.minute != null ? ` ${fixture.minute}′` : ''}
        </span>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)] items-center gap-2 px-3 py-6 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <TeamLogo url={null} name={home} size={48} />
          <strong className="line-clamp-2 text-sm font-extrabold text-[#202832]">{home ?? (isFa ? 'تیم میزبان' : 'Home')}</strong>
        </div>
        <div className="text-center">
          <div className="whitespace-nowrap text-2xl font-black tabular-nums text-[#1D2938] sm:text-3xl">
            {mode === 'live' && homeScore != null && awayScore != null ? `${homeScore} : ${awayScore}` : 'VS'}
          </div>
          <p className="mt-2 text-[10px] text-[#738293]">{mode === 'live' ? (isFa ? 'نتیجه زنده' : 'Live score') : (isFa ? 'پیش از مسابقه' : 'Pre-match')}</p>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <TeamLogo url={null} name={away} size={48} />
          <strong className="line-clamp-2 text-sm font-extrabold text-[#202832]">{away ?? (isFa ? 'تیم مهمان' : 'Away')}</strong>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E9EDF2] bg-[#F9FAFB] px-4 py-2.5 text-xs text-[#708093]">
        <span>{isFa ? 'شناسه مسابقه' : 'Fixture ID'}: {fi}</span>
        <span>{isFa ? 'منبع ضرایب: BetsAPI' : 'Odds source: BetsAPI / Bet365'}</span>
      </footer>
    </section>

    <div role="status" className="rounded-xl border border-[#F2E2B5] bg-[#FFF9E8] px-3 py-2.5 text-xs font-medium leading-5 text-[#86601F]">
      {isFa ? 'ضرایب فقط برای بررسی نمایش داده می‌شوند. ثبت شرط تا زمان تأیید اتصال مالی و تسویه غیرفعال است.' :
        'Prices are for viewing only. Wager placement is disabled until price acceptance and settlement are validated.'}
    </div>

    {feedError && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{isFa ? 'مارکت‌های این مسابقه دریافت نشدند' : 'Markets could not be loaded'}: {feedError}</p>}
    {(!feedError || activeMarkets.length > 0) && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#253345]">{isFa ? 'مارکت‌های مسابقه' : 'Match markets'}</h2>
        {mode === 'live' && <span className="text-[11px] font-medium text-[#5F7894]">
          {isFa ? 'بررسی خودکار هر ۱۰ ثانیه' : 'Auto-check every 10s'}
          {lastChanged ? ` · ${isFa ? 'آخرین تغییر' : 'Last change'} ${lastChanged}` : ''}
        </span>}
        <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#758496]">
          {validMarkets.length} {isFa ? 'مارکت با عنوان معتبر' : 'markets with verified labels'}
        </span>
      </div>
      {snapshotCount > validMarkets.length && (
        <p className="text-[11px] leading-5 text-[#758496]">
          {isFa
            ? `${snapshotCount - validMarkets.length} گروه دیگر از API دریافت شده، اما عنوان گزینه‌هایشان کافی نیست؛ برای جلوگیری از نمایش گمراه‌کننده پنهان شده‌اند.`
            : `${reportedCount - validMarkets.length} additional API market groups have insufficiently identified outcomes and are hidden to avoid misleading prices.`}
        </p>
      )}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8394A4]" />
        <input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(40); }}
          placeholder={isFa ? 'جست‌وجوی مارکت یا گزینه…' : 'Search markets or selections…'}
          className="w-full rounded-xl border border-[#D9E2EA] bg-white py-3 pl-9 pr-3 text-sm text-[#243345] outline-none focus:border-[#087FF5]" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map(g => <button key={g.id} type="button"
          onClick={() => { setGroup(g.id); setLimit(40); }}
          className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-extrabold ${group === g.id ? 'border-[#087FF5] bg-[#087FF5] text-white' : 'border-[#DCE5ED] bg-white text-[#495A6C]'}`}>
          {isFa ? g.fa : g.en}
        </button>)}
      </div>
      {!filtered.length && <p className="rounded-xl bg-white p-5 text-sm text-[#738293]">{isFa ? 'مارکت قابل نمایشی در این دسته وجود ندارد.' : 'No labeled selections available in this category.'}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.slice(0, limit).map(m => <MarketSection key={m.key} market={m} isFa={isFa} />)}
      </div>
      {filtered.length > limit && <button type="button"
        onClick={() => setLimit(n => n + 40)}
        className="w-full rounded-xl border border-[#B5D9FC] bg-white px-4 py-3 text-sm font-extrabold text-[#087FF5]">
        {isFa ? 'نمایش مارکت‌های بیشتر' : 'Load more markets'} · {filtered.length - limit}
      </button>}
    </>}
  </main>;
}
