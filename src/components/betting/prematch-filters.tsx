'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Check,
  Search,
  X,
} from 'lucide-react';
import { MatchListClient } from '@/components/betting/match-list-client';
import type { MatchView } from '@/components/betting/match-card';

type League = {
  id: string;
  sportKey: string;
  countryCode: string | null;
  nameEn: string;
  nameFa: string;
  slug: string;
  logoUrl: string | null;
  matchCount?: number;
};

type Props = {
  items: MatchView[];
  liveEnabled: boolean;
  leagues?: League[];
  sportKey?: string;
  leagueId?: string;
  initialPage?: number;
  initialPageSize?: number;
  initialTotal?: number;
  initialHasMore?: boolean;
};

const SPORTS = [
  { key: 'football', label: 'Football', icon: '/sports-new/svg/football.svg', href: '/sports/football' },
  { key: 'basketball', label: 'Basketball', icon: '/sports-new/svg/basketball.svg', href: '/sports/basketball' },
  { key: 'tennis', label: 'Tennis', icon: '/sports-new/svg/tennis.svg', href: '/sports/tennis' },
  { key: 'volleyball', label: 'Volleyball', icon: '/sports-new/svg/volleyball.svg', href: '/sports/volleyball' },
  { key: 'ice-hockey', label: 'Ice Hockey', icon: '/sports-new/svg/ice-hockey.svg', href: '/sports/ice-hockey' },
  { key: 'table-tennis', label: 'Table Tennis', icon: '/sports-new/svg/table-tennis.svg', href: '/sports/table-tennis' },
  { key: 'baseball', label: 'Baseball', icon: '/sports-new/svg/baseball.svg', href: '/sports/baseball' },
  { key: 'handball', label: 'Handball', icon: '/sports-new/svg/handball.svg', href: '/sports/handball' },
  { key: 'cricket', label: 'Cricket', icon: '/sports-new/svg/cricket.svg', href: '/sports/cricket' },
  { key: 'boxing', label: 'Boxing', icon: '/sports-new/svg/boxing.svg', href: '/sports/boxing' },
  { key: 'mma', label: 'MMA', icon: '/sports-new/svg/mma.svg', href: '/sports/mma' },
  { key: 'american-football', label: 'American Football', icon: '/sports-new/svg/american-football.svg', href: '/sports/american-football' },
  { key: 'esports', label: 'Esports', icon: '/sports-new/svg/esports.svg', href: '/sports/esports' },
] as const;

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'England', ENG: 'England', ES: 'Spain', IT: 'Italy', DE: 'Germany',
  FR: 'France', TR: 'Turkey', AR: 'Argentina', BR: 'Brazil', US: 'USA',
  AU: 'Australia', BE: 'Belgium', AT: 'Austria', NL: 'Netherlands',
  PT: 'Portugal', SE: 'Sweden', DK: 'Denmark', NO: 'Norway', CH: 'Switzerland',
  MX: 'Mexico', CL: 'Chile', CO: 'Colombia', JP: 'Japan', KR: 'South Korea',
  CN: 'China', IN: 'India', ZA: 'South Africa',
};

const COUNTRY_FLAGS: Record<string, string> = {
  GB: '🏴', ENG: '🏴', ES: '🇪🇸', IT: '🇮🇹', DE: '🇩🇪', FR: '🇫🇷',
  TR: '🇹🇷', AR: '🇦🇷', BR: '🇧🇷', US: '🇺🇸', AU: '🇦🇺', BE: '🇧🇪',
  AT: '🇦🇹', NL: '🇳🇱', PT: '🇵🇹', SE: '🇸🇪', DK: '🇩🇰', NO: '🇳🇴',
  CH: '🇨🇭', MX: '🇲🇽', CL: '🇨🇱', CO: '🇨🇴', JP: '🇯🇵', KR: '🇰🇷',
  CN: '🇨🇳', IN: '🇮🇳', ZA: '🇿🇦',
};

function countryName(code: string | null) {
  if (!code) return 'International';
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

function countryFlag(code: string | null) {
  if (!code) return '🌐';
  return COUNTRY_FLAGS[code.toUpperCase()] ?? '🌐';
}

export function PrematchFilters({
  items,
  liveEnabled,
  leagues = [],
  sportKey = 'football',
  leagueId,
  initialPage = 1,
  initialPageSize = 50,
  initialTotal = items.length,
  initialHasMore = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [leagueView, setLeagueView] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [loadedItems, setLoadedItems] = useState<MatchView[]>(items);
  const [loadedPage, setLoadedPage] = useState(initialPage);
  const [loadedTotal, setLoadedTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadedItems(items);
    setLoadedPage(initialPage);
    setLoadedTotal(initialTotal);
    setHasMore(initialHasMore);
  }, [items, initialPage, initialTotal, initialHasMore]);

  async function loadMoreLeagueMatches() {
    if (!leagueId || !sportKey || loadingMore || !hasMore) return;

    const nextPage = loadedPage + 1;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        sport: sportKey,
        league: leagueId,
        page: String(nextPage),
        pageSize: String(initialPageSize),
      });

      const response = await fetch(`/api/v1/matches?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) return;

      const payload = await response.json();
      const data = payload?.data ?? payload;
      const nextItems = Array.isArray(data?.items)
        ? (data.items as MatchView[])
        : [];

      setLoadedItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...nextItems.filter((item) => !seen.has(item.id)),
        ];
      });

      setLoadedPage(Number(data?.page ?? nextPage));
      setLoadedTotal(Number(data?.total ?? loadedTotal));
      setHasMore(Boolean(data?.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }

  const currentSport = SPORTS.find((sport) => sport.key === sportKey) ?? SPORTS[0];
  const currentSportLeagues = useMemo(
    () => leagues.filter((league) => league.sportKey === currentSport.key),
    [leagues, currentSport.key],
  );

  const groupedCountries = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = currentSportLeagues.filter((league) => {
      if (!q) return true;

      return (
        league.nameEn.toLowerCase().includes(q) ||
        league.nameFa.toLowerCase().includes(q) ||
        countryName(league.countryCode).toLowerCase().includes(q)
      );
    });

    const groups = new Map<string, League[]>();

    for (const league of filtered) {
      const code = league.countryCode?.toUpperCase() ?? 'INT';
      const existing = groups.get(code) ?? [];
      existing.push(league);
      groups.set(code, existing);
    }

    return [...groups.entries()].sort((a, b) =>
      countryName(a[0] === 'INT' ? null : a[0]).localeCompare(
        countryName(b[0] === 'INT' ? null : b[0]),
      ),
    );
  }, [currentSportLeagues, search]);

  const totalSportMatches = currentSportLeagues.reduce(
    (sum, league) => sum + (league.matchCount ?? 0),
    0,
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const resetSportsView = () => {
    setLeagueView(false);
    setSearch('');
    setExpandedCountry(null);
  };

  const openFootball = () => {
    setLeagueView(true);
    setSearch('');
    setExpandedCountry(null);
  };

  const toggleCountry = (code: string) => {
    setExpandedCountry((current) => (current === code ? null : code));
  };

  return (
    <div className="space-y-3">
      <div ref={menuRef} className="relative z-30">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={`group flex w-full items-center justify-between rounded-[18px] border px-4 py-3.5 text-left transition-all duration-200 ${
            open
              ? 'border-[#3B82F6] bg-[#0B1A2A] shadow-[0_8px_30px_rgba(7,21,34,.24)]'
              : 'border-[#DDE3EA] bg-white shadow-[0_2px_12px_rgba(15,23,42,.07)] hover:border-[#B9C7D8]'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] transition-colors ${
                open ? 'bg-[#102943]' : 'bg-[#F3F6F9]'
              }`}
            >
              <img
                src={currentSport.icon}
                alt=""
                className="h-8 w-8 object-contain"
              />
            </div>

            <div className="min-w-0">
              <div
                className={`text-[15px] font-black ${
                  open ? 'text-white' : 'text-[#17191D]'
                }`}
              >
                Sports
              </div>
              <div
                className={`truncate text-[12px] font-semibold ${
                  open ? 'text-[#94A3B8]' : 'text-[#7A828C]'
                }`}
              >
                {currentSport.label}
                {totalSportMatches > 0
                  ? ` · ${totalSportMatches} events`
                  : ''}
              </div>
            </div>
          </div>

          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
              open
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#F3F5F7] text-[#667085]'
            }`}
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        <div
          className={`absolute left-0 right-0 top-[calc(100%+8px)] origin-top transition-all duration-200 ease-out ${
            open
              ? 'visible translate-y-0 scale-100 opacity-100'
              : 'invisible -translate-y-2 scale-[0.98] opacity-0'
          }`}
        >
          <div className="overflow-hidden rounded-[20px] border border-[#203B56] bg-[#071522] p-2 shadow-[0_18px_50px_rgba(2,8,23,.38)]">
            {!leagueView ? (
              <div className="p-2">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div>
                    <div className="text-[15px] font-black text-white">
                      Choose a sport
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                      Select a sport to continue
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1A2A] text-[#94A3B8] transition hover:bg-[#102943] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid max-h-[52vh] grid-cols-1 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
                  {SPORTS.map((sport) => {
                    const active = sport.key === currentSport.key;

                    if (active) {
                      return (
                        <button
                          key={sport.key}
                          type="button"
                          onClick={() => { setLeagueView(true); setSearch(''); setExpandedCountry(null); }}
                          className="flex min-h-[52px] items-center gap-3 rounded-[14px] border border-[#3B82F6] bg-[#2563EB] px-3 text-left shadow-[0_4px_16px_rgba(37,99,235,.22)] transition-all duration-150 hover:bg-[#1D4ED8]"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white/10">
                            <img
                              src={sport.icon}
                              alt=""
                              className="h-7 w-7 object-contain"
                            />
                          </div>
                          <span className="flex-1 text-[13px] font-black text-white">
                            {sport.label}
                          </span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                            <ChevronLeft className="h-4 w-4 text-white" />
                          </span>
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={sport.key}
                        href={sport.href}
                        onClick={() => setOpen(false)}
                        className="group flex min-h-[52px] items-center gap-3 rounded-[14px] border border-[#162D43] bg-[#0B1A2A] px-3 transition-all duration-150 hover:border-[#2B5277] hover:bg-[#102943]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#102238]">
                          <img
                            src={sport.icon}
                            alt=""
                            className="h-6 w-6 object-contain brightness-0 invert opacity-90 transition-transform duration-200 group-hover:scale-105"
                          />
                        </div>
                        <span className="flex-1 text-[13px] font-bold text-[#E2E8F0]">
                          {sport.label}
                        </span>
                        <ChevronLeft className="h-4 w-4 text-[#64748B] transition-transform group-hover:-translate-x-0.5 group-hover:text-[#CBD5E1]" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-2">
                <div className="sticky top-0 z-10 mb-2 bg-[#071522] pb-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetSportsView}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1A2A] text-[#CBD5E1] transition hover:bg-[#102943] hover:text-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#102943]">
                      <img
                        src="/sports-new/svg/football.svg"
                        alt=""
                        className="h-7 w-7 object-contain"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-black text-white">
                        {currentSport.label}
                      </div>
                      <div className="text-[10px] font-medium text-[#64748B]">
                        Countries & leagues
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1A2A] text-[#94A3B8] transition hover:bg-[#102943] hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 rounded-[13px] border border-[#203B56] bg-[#0B1A2A] px-3 transition-colors focus-within:border-[#3B82F6]">
                    <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setExpandedCountry(null);
                      }}
                      placeholder="Search countries or leagues..."
                      className="h-11 min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-white outline-none placeholder:text-[#64748B]"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="text-[#64748B] hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-0.5">
                  {groupedCountries.length === 0 ? (
                    <div className="rounded-[14px] border border-[#162D43] bg-[#0B1A2A] px-4 py-10 text-center">
                      <Search className="mx-auto mb-2 h-6 w-6 text-[#475569]" />
                      <div className="text-[13px] font-bold text-[#CBD5E1]">
                        No {currentSport.label.toLowerCase()} leagues found
                      </div>
                      <div className="mt-1 text-[11px] text-[#64748B]">
                        Try another country or league name
                      </div>
                    </div>
                  ) : (
                    groupedCountries.map(([code, countryLeagues]) => {
                      const expanded =
                        search.trim().length > 0 ||
                        expandedCountry === code;

                      return (
                        <div
                          key={code}
                          className={`overflow-hidden rounded-[14px] border transition-all duration-200 ${
                            expanded
                              ? 'border-[#2B5277] bg-[#0B1A2A]'
                              : 'border-[#162D43] bg-[#0B1A2A]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCountry(code)}
                            className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#102943]"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#102238] text-[21px] leading-none">
                              {countryFlag(code === 'INT' ? null : code)}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-black text-white">
                                {countryName(code === 'INT' ? null : code)}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-medium text-[#64748B]">
                                {countryLeagues.length}{' '}
                                {countryLeagues.length === 1
                                  ? 'league'
                                  : 'leagues'}
                              </span>
                            </span>

                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                                expanded
                                  ? 'bg-[#2563EB] text-white'
                                  : 'bg-[#102238] text-[#64748B]'
                              }`}
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </span>
                          </button>

                          <div
                            className={`grid transition-all duration-200 ${
                              expanded
                                ? 'grid-rows-[1fr] opacity-100'
                                : 'grid-rows-[0fr] opacity-0'
                            }`}
                          >
                            <div className="min-h-0 overflow-hidden">
                              <div className="space-y-1 border-t border-[#162D43] p-1.5">
                                {countryLeagues.map((league) => (
                                  <Link
                                    key={league.id}
                                    href={`/sports/${currentSport.key}/league/${league.id}`}
                                    onClick={() => setOpen(false)}
                                    className="group flex items-center gap-3 rounded-[11px] border border-transparent bg-[#071522] px-3 py-2.5 transition-all duration-150 hover:border-[#2B5277] hover:bg-[#102943]"
                                  >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#102238]">
                                      {league.logoUrl ? (
                                        <img
                                          src={league.logoUrl}
                                          alt=""
                                          className="h-7 w-7 object-contain"
                                        />
                                      ) : (
                                        <span className="text-[17px]">⚽</span>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-[12px] font-extrabold text-[#F8FAFC]">
                                        {league.nameEn}
                                      </div>
                                      <div className="mt-0.5 text-[10px] font-medium text-[#64748B]">
                                        {league.matchCount ?? 0} events
                                      </div>
                                    </div>

                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0B1A2A] text-[#64748B] transition-all group-hover:bg-[#2563EB] group-hover:text-white">
                                      <ChevronLeft className="h-3.5 w-3.5" />
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2 px-1 pt-1">
                  <Check className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span className="text-[10px] font-medium text-[#64748B]">
                    Select a league to view its matches
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MatchListClient matches={loadedItems} liveEnabled={liveEnabled} />

      {leagueId && loadedItems.length > 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-5">
          <div className="text-[10px] font-medium text-[#9298A1]">
            Showing {loadedItems.length} of {loadedTotal} events
          </div>

          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadMoreLeagueMatches()}
              disabled={loadingMore}
              className="rounded-xl border border-[#DDE1E6] bg-white px-7 py-3 text-xs font-extrabold text-[#20242A] transition hover:bg-[#F5F7F9] disabled:cursor-wait disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          ) : (
            <div className="text-[10px] font-medium text-[#9298A1]">
              All events have been loaded
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
