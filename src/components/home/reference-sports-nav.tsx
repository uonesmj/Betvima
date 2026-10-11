'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MatchCard, type MatchView } from "@/components/betting/match-card";
import { usePathname, useSearchParams } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
  badge?: string;
};

type SportItem = {
  label: string;
  sportKey?: string;
  image: string;
  href: string;
};

const mainItems: NavItem[] = [
  { label: 'Top', href: '/' },
  { label: 'Live', href: '/live' },
  { label: 'Upcoming', href: '/sports/football' },
  { label: 'Top Bets', href: '/topbets', badge: 'NEW' },
  { label: 'Esports', href: '/sports/esports' },
  { label: 'Bet history', href: '/bets' },
];

const sports: SportItem[] = [
  { label: 'Top', image: '/icons/top-crown.svg', href: '/' },
  { label: 'Football', sportKey: 'football', image: '/icons/sports/football.svg', href: '/sports/football' },
  { label: 'Tennis', sportKey: 'tennis', image: '/icons/sports/tennis.svg', href: '/sports/tennis' },
  { label: 'Basketball', sportKey: 'basketball', image: '/icons/sports/basketball.svg', href: '/sports/basketball' },
  { label: 'Ice Hockey', sportKey: 'hockey', image: '/icons/sports/hockey.svg', href: '/sports/hockey' },
  { label: 'Table Tennis', sportKey: 'table-tennis', image: '/icons/sports/table-tennis.svg', href: '/sports/table-tennis' },
  { label: 'Volleyball', sportKey: 'volleyball', image: '/icons/sports/volleyball.svg', href: '/sports/volleyball' },
  { label: 'Baseball', sportKey: 'baseball', image: '/icons/sports/baseball.svg', href: '/sports/baseball' },
  { label: 'American Football', sportKey: 'american-football', image: '/icons/sports/football.svg', href: '/sports/american-football' },
  { label: 'MMA', sportKey: 'mma', image: '/icons/sports/football.svg', href: '/sports/mma' },
  { label: 'Boxing', sportKey: 'boxing', image: '/icons/sports/football.svg', href: '/sports/boxing' },
  { label: 'CS2', sportKey: 'esports', image: '/icons/sports/cs2.svg', href: '/sports/esports' },
];

const tournaments: NavItem[] = [
  { label: 'Premier League', href: '/sports/football' },
  { label: 'Champions League', href: '/sports/football' },
  { label: 'Europa League', href: '/sports/football' },
  { label: 'LaLiga', href: '/sports/football' },
  { label: 'Bundesliga', href: '/sports/football' },
  { label: 'Serie A', href: '/sports/football' },
  { label: 'UFC', href: '/sports/esports' },
  { label: 'Esports', href: '/sports/esports' },
];


function searchMatchView(m: any): MatchView { const p=Array.isArray(m.participants)?m.participants:[]; return { id:m.id, sportKey:m.sportKey??"football", leagueId:m.leagueId??null, leagueName:m.leagueName??null, leagueLogoUrl:m.leagueLogoUrl??null, countryCode:m.countryCode??null, status:m.status??"scheduled", scheduledAt:m.scheduledAt??m.startTime??new Date().toISOString(), minute:m.minute??null, homeScore:m.homeScore??null, awayScore:m.awayScore??null, participants:p.map((x:any)=>({teamId:x.teamId??"",role:String(x.role??"").toUpperCase(),name:x.name??"",logoUrl:x.logoUrl??x.imageUrl??null})), isLive:Boolean(m.isLive), isBettingAvailable:Boolean(m.isBettingAvailable), marketsCount:m.marketsCount??0, topMarkets:Array.isArray(m.topMarkets)?m.topMarkets.map((x:any)=>({id:x.id,key:x.key??"",name:x.name??x.nameEn??x.nameFa??"",status:x.status??"open",selections:Array.isArray(x.selections)?x.selections.map((z:any)=>({id:z.id,code:z.code??"",name:z.name??z.nameEn??z.nameFa??"",oddsScaled:String(z.oddsScaled??"0"),previousOddsScaled:z.previousOddsScaled==null?null:String(z.previousOddsScaled),status:z.status??"open",movement:z.movement,oddsVersion:Number(z.oddsVersion??0)})):[]})):[] }; }

function SportsSearch() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [position, setPosition] = useState({ top: 0, right: 12 });
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  };

  const runSearch = async (value: string) => {
    const query = value.trim();

    if (query.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/v1/matches?q=${encodeURIComponent(query)}&page=1&pageSize=10`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const matches = Array.isArray(data?.data?.items)
        ? data.data.items
        : Array.isArray(data?.items)
          ? data.items
          : [];

      const mapped = matches
        .map((match: any) => {
          const participants = Array.isArray(match?.participants)
            ? match.participants
            : [];

          const home =
            participants.find(
              (item: any) =>
                String(item?.role ?? '').toUpperCase() === 'HOME',
            )?.name ??
            match?.homeTeamName ??
            match?.homeTeam?.name ??
            '';

          const away =
            participants.find(
              (item: any) =>
                String(item?.role ?? '').toUpperCase() === 'AWAY',
            )?.name ??
            match?.awayTeamName ??
            match?.awayTeam?.name ??
            '';

          return {
            ...match,
            type: 'match',
            id: match?.id,
            title:
              home && away
                ? `${home} vs ${away}`
                : match?.name ?? 'Match',
            subtitle:
              match?.leagueName ??
              match?.sportKey ??
               'Sports',
          };
        })
        .filter((item: any) => Boolean(item.id));

      setResults(mapped);
    } catch (err) {
      console.error('[NOVA SEARCH]', err);
      setResults([]);
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const openSearch = () => {
    updatePosition();
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const close = () => {
    setOpen(false);
    setQ('');
    setResults([]);
    setError('');
  };

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const update = () => updatePosition();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const dropdown =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed z-[2147483647] w-[min(94vw,390px)] rounded-2xl border border-black/10 bg-white p-2 shadow-2xl"
            style={{
              top: position.top,
              right: position.right,
            }}
          >
            <div className="flex items-center gap-2 rounded-xl bg-[#F5F6F8] px-3">
              <span
                className="text-lg text-[#68707A]"
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  const value = e.target.value;
                  setQ(value);
                  void runSearch(value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') close();
                }}
                placeholder={t('common.search')}
                aria-label={t('common.search')}
                autoComplete="off"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#17191C] outline-none"
              />

              <button
                type="button"
                onClick={close}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xl text-[#68707A] hover:bg-white"
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>

            {q.trim().length >= 2 && (
              <div className="mt-2 max-h-[360px] overflow-y-auto overscroll-contain">
                {loading ? (
                  <div className="px-3 py-5 text-center text-sm text-[#68707A]">
                     {t('common.loading')} 
                  </div>
                ) : error ? (
                  <div className="px-3 py-4 text-center text-sm text-red-600">
                    {error}
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-2">
                    {results.map((item: any) => (
                      <MatchCard key={`${item.type}-${item.id}`} match={searchMatchView(item)} compact />
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-5 text-center text-sm text-[#68707A]">
                    {t('common.empty')}
                  </div>
                )}
              </div>
            )}

            {q.trim().length > 0 && q.trim().length < 2 && (
              <div className="px-3 py-4 text-center text-xs text-[#68707A]">
                Type at least 2 characters
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {!open ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={openSearch}
          aria-label={t('common.search')}
          title={t('common.search')}
          className="flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#17191C] hover:bg-white active:bg-white"
        >
          <span className="text-xl leading-none" aria-hidden="true">
            ⌕
          </span>
          <span className="hidden sm:inline">{t('common.search')}</span>
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          title={t('common.close')}
          className="flex h-10 min-w-[44px] items-center justify-center rounded-xl px-3 text-xl text-[#17191C] hover:bg-white"
        >
          ×
        </button>
      )}

      {dropdown}
    </>
  );
}

function PopularLeagues() {
  const leagues = [
    { label: 'LaLiga', country: 'Spain', flag: '🇪🇸', logo: '/sports/leagues/laliga.svg', href: '/sports/football/league/3b47a24a-62e3-40bf-8db9-0534445179dd' },
    { label: 'Premier League', country: 'England', flag: '🇬🇧', logo: '/sports/leagues/premier-league.svg', href: '/sports/football/league/e1748479-2d19-48dd-b09a-e1e80343fd49' },
    { label: 'Champions League', country: 'Europe', flag: '🇪🇺', logo: '/sports/leagues/champions-league.svg', href: '/sports/football/league/3f60524b-f30d-40a2-8ed8-a5ddd228f455' },
    { label: 'Serie A', country: 'Italy', flag: '🇮🇹', logo: '/sports/leagues/serie-a.svg', href: '/sports/football/league/d30401ba-2457-4ca2-8f6c-d1a813e7152e' },
    { label: 'Bundesliga', country: 'Germany', flag: '🇩🇪', logo: '/sports/leagues/bundesliga.svg', href: '/sports/football/league/63a3b049-43c4-4248-adec-9dcb6eedaa9f' },
    { label: 'Ligue 1', country: 'France', flag: '🇫🇷', logo: '/sports/leagues/ligue-1.png', href: '/sports/football/league/9c2b48d5-4b2a-4e34-b1d3-0ef2a361c3a6' },
    { label: 'Europa League', country: 'Europe', flag: '🇪🇺', logo: '/sports/leagues/europa-league.svg', href: '/sports/football/league/bd6ff072-e2d9-4755-a34b-a68adde43ae9' },
    { label: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', logo: '/sports/leagues/eredivisie.svg', href: '/sports/football/league/bb30e7a6-89b0-417f-8f5b-1e018d02fa66' },
    { label: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', logo: '/sports/leagues/liga-portugal.svg', href: '/sports/football/league/537e7cbe-5fbc-4bf0-b853-3b21fb476d41' },
    { label: 'MLS', country: 'USA', flag: '🇺🇸', logo: '/sports/leagues/mls.svg', href: '/sports/football/league/e41e36aa-987a-4638-be16-d6b5dcf4354c' },
    { label: 'NBA', country: 'USA', flag: '🇺🇸', logo: '/sports/leagues/nba.svg', href: '/sports/basketball/league/c32fee51-10c0-4ac5-8071-136715d95427' },
    { label: 'Cricket', country: 'International', flag: '🌐', logo: '/sports/leagues/cricket.svg', href: '/sports/cricket' },
    { label: 'NHL', country: 'USA / Canada', flag: '🇨🇦', logo: '/icons/sports/hockey.svg', href: '/sports/ice-hockey' },
    { label: 'Tennis', country: 'International', flag: '🌐', logo: '/sports/leagues/tennis.svg', href: '/sports/tennis' },
    { label: 'Baseball', country: 'International', flag: '🌐', logo: '/sports-new/svg/baseball.svg', href: '/sports/baseball' },
  ];

  return (
    <section className="border-t border-[#E1E7EF] bg-[#F3F7FC] px-3 pb-4 pt-3 sm:px-4 sm:pb-5 sm:pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#087FF5] text-[22px] shadow-[0_6px_16px_rgba(8,127,245,.20)]">
            <span aria-hidden="true">🏆</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-black leading-tight tracking-[-.02em] text-[#111827] sm:text-[20px]">
              Popular Leagues
            </h2>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[#8A96A6] sm:text-[12px]">
              Most followed leagues right now
            </p>
          </div>
        </div>
        <Link
          href="/sports/football"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-[13px] border border-[#CDE2F8] bg-white px-3.5 text-[12px] font-extrabold text-[#087FF5] shadow-[0_4px_12px_rgba(8,127,245,.08)] transition hover:border-[#A9D0F4] hover:bg-[#F8FBFF] active:scale-[.98]"
        >
          <span>View all</span>
          <span className="text-[18px] leading-none">›</span>
        </Link>
      </div>

      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2 pb-1.5 sm:gap-2.5">
          {leagues.map((league) => (
            <Link
              key={league.label}
              href={league.href}
              className="group flex h-[116px] w-[calc((100vw-46px)/4)] shrink-0 flex-col rounded-[15px] border border-[#E1E7EF] bg-white p-2 shadow-[0_4px_14px_rgba(24,39,58,.065)] transition duration-200 hover:-translate-y-1 hover:border-[#C8DDF2] hover:shadow-[0_9px_20px_rgba(24,39,58,.10)] active:scale-[.98] sm:h-[123px] sm:w-[calc((100vw-70px)/5)] sm:p-2.5"
            >
              <div className="flex h-[56px] items-center justify-center rounded-[12px] bg-[#F7F9FC] p-2 shadow-[inset_0_0_0_1px_#EEF2F6]">
                <img
                  src={league.logo}
                  alt=""
                  className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              <div className="mt-1 min-w-0">
                <div className="truncate text-[12px] font-black leading-tight text-[#172033] sm:text-[13px]">
                  {league.label}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-[#737F8F]">
                  <span aria-hidden="true">{league.flag}</span>
                  <span className="truncate">{league.country}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
export function ReferenceSportsNav({ showTournament = true, showSportsCarousel = true }: { showTournament?: boolean; showSportsCarousel?: boolean }) {
  const { t } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const liveSport = searchParams.get('sport');
  const sportsScrollerRef = useRef<HTMLDivElement>(null);
  const [liveSportCounts, setLiveSportCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (pathname !== '/live') return;
    let cancelled = false;
    const loadLiveSportCounts = async () => {
      try {
        const response = await fetch('/api/v1/live?limit=1', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const counts = data?.data?.liveSportCounts ?? data?.liveSportCounts;
        if (!cancelled && counts && typeof counts === 'object') setLiveSportCounts(counts);
      } catch {}
    };
    loadLiveSportCounts();
    const timer = window.setInterval(loadLiveSportCounts, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [pathname]);
  useEffect(() => {
    if (pathname !== '/live' || liveSport) return;
    const el = sportsScrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, [pathname, liveSport]);

  const isMainActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/live') return pathname === '/live' || pathname.startsWith('/live/');
    if (href === '/bets') return pathname === '/bets' || pathname.startsWith('/bets/');
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isSportActive = (href: string) => {
    if (pathname === '/live') {
      const item = sports.find((sport) => sport.href === href);
      const key = href === '/' ? null : (item?.sportKey ?? href.split('/').pop());
      return liveSport === key || (href === '/' && !liveSport);
    }
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      aria-label="Sports navigation"
      className="sticky top-[64px] z-40 w-full border-b border-[#D7DBE1] bg-[#EEF0F4] text-[#171A1F]"
    >
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="overflow-x-auto px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-1.5">
            {mainItems.map((item) => {
              const active = isMainActive(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`relative flex h-10 shrink-0 items-center gap-2 rounded-[14px] px-3.5 text-[14px] font-bold transition ${
                    active
                      ? 'bg-white text-[#171A1F] shadow-[0_1px_4px_rgba(0,0,0,.06)]'
                      : 'text-[#25292F] hover:bg-white/70'
                  }`}
                >
                  {item.badge ? (
                    <span className="rounded-full bg-[#F0442E] px-1.5 py-0.5 text-[9px] font-black leading-none text-white">
                      {item.badge}
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="ml-auto">
              <SportsSearch />
            </div>
          </div>
        </div>

        {showSportsCarousel ? (
          <div
            ref={sportsScrollerRef}
            data-testid="sport-carousel"
            className="overflow-x-auto px-2 pb-2 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-w-max items-center gap-1.5 sm:gap-2">
              {sports.map((sport) => {
                const active = isSportActive(sport.href);
                return (
                  <Link
                    key={sport.label}
                    href={
                      pathname === '/live'
                        ? sport.label === 'Top'
                          ? '/live'
                          : `/live?sport=${encodeURIComponent(sport.sportKey ?? sport.href.split('/').pop() ?? '')}`
                        : sport.href
                    }
                    className={`group flex h-[68px] w-[72px] shrink-0 flex-col items-center justify-center rounded-[12px] border bg-white px-1.5 transition-all duration-200 sm:h-[70px] sm:w-[78px] ${
                      active
                        ? 'border-[#087FF5] bg-[#F8FBFF] shadow-[0_2px_8px_rgba(8,127,245,.12)]'
                        : 'border-[#E3E7EC] shadow-[0_1px_5px_rgba(25,35,50,.045)] hover:border-[#CBD5E1] hover:bg-[#FAFBFC]'
                    }`}
                  >
                    <span
                      className={`flex h-[30px] w-[30px] items-center justify-center rounded-[8px] ${
                        active ? 'bg-[#EAF4FF]' : 'bg-[#F5F7F9]'
                      }`}
                    >
                      <img
                        src={sport.image}
                        alt=""
                        loading="lazy"
                        className={`h-[21px] w-[21px] object-contain transition-transform duration-200 group-hover:scale-105 ${
                          active ? '' : 'grayscale opacity-75'
                        }`}
                      />
                    </span>
                    <span className={`mt-1 max-w-full truncate whitespace-nowrap text-[11px] font-bold leading-none tracking-[-0.01em] sm:text-[11.5px] ${
                      active ? 'text-[#087FF5]' : 'text-[#202733]'
                    }`}>
                      {sport.label}
                    </span>
                    {pathname === '/live' ? (
                      <span className="mt-0.5 text-[9px] font-semibold leading-none tabular-nums text-[#8993A1]">
                        {sport.sportKey ? (liveSportCounts[sport.sportKey] ?? 0) : Object.values(liveSportCounts).reduce((sum, count) => sum + count, 0)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
        {showTournament ? <PopularLeagues /> : null}
      </div>
    </nav>
  );
}
