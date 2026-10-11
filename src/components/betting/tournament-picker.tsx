'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock3, Trophy, X } from 'lucide-react';

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

type Row = {
  key: string;
  title: string;
  count: number;
  logoUrl: string | null;
  league?: League;
};

const TIME_FILTERS = [
  { label: 'All', hours: null },
  { label: '1h', hours: 1 },
  { label: '2h', hours: 2 },
  { label: '4h', hours: 4 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '1d', hours: 24 },
  { label: '2d', hours: 48 },
];

const SPORT_NAMES: Record<string, string> = {
  football: 'Football',
  soccer: 'Football',
  tennis: 'Tennis',
  basketball: 'Basketball',
  volleyball: 'Volleyball',
  handball: 'Handball',
  baseball: 'Baseball',
  cricket: 'Cricket',
  boxing: 'Boxing',
  mma: 'MMA',
  'ice-hockey': 'Ice Hockey',
  'table-tennis': 'Table Tennis',
  esports: 'Esports',
};

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'England',
  ENG: 'England',
  ES: 'Spain',
  IT: 'Italy',
  DE: 'Germany',
  FR: 'France',
  TR: 'Turkey',
  AR: 'Argentina',
  BR: 'Brazil',
  US: 'USA',
  AU: 'Australia',
  BE: 'Belgium',
  AT: 'Austria',
  NL: 'Netherlands',
  PT: 'Portugal',
  SE: 'Sweden',
  DK: 'Denmark',
  NO: 'Norway',
  CH: 'Switzerland',
  MX: 'Mexico',
  CL: 'Chile',
  CO: 'Colombia',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  IN: 'India',
  ZA: 'South Africa',
};

function sportName(sport: string) {
  return SPORT_NAMES[sport] ?? sport.replace(/[-_]/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
}

function inferCountry(league: League) {
  if (league.countryCode) {
    return COUNTRY_NAMES[league.countryCode.toUpperCase()] ?? league.countryCode.toUpperCase();
  }

  const text = `${league.nameEn} ${league.slug}`.toLowerCase();

  const countries: [string, string[]][] = [
    ['England', ['england', 'english', 'premier_league', 'championship', 'league_one', 'league_two']],
    ['Spain', ['spain', 'spanish', 'la_liga', 'laliga']],
    ['Italy', ['italy', 'italian', 'serie_a', 'serie_b']],
    ['Germany', ['germany', 'german', 'bundesliga']],
    ['France', ['france', 'french', 'ligue_1', 'ligue_2']],
    ['Brazil', ['brazil', 'brasileiro']],
    ['Argentina', ['argentina']],
    ['Belgium', ['belgium', 'belgian']],
    ['Austria', ['austria', 'austrian']],
    ['Sweden', ['sweden', 'swedish', 'allsvenskan']],
    ['Netherlands', ['netherlands', 'dutch', 'eredivisie']],
    ['Portugal', ['portugal', 'portuguese']],
    ['Turkey', ['turkey', 'turkish']],
    ['USA', ['usa', 'united_states', 'mls']],
    ['Mexico', ['mexico', 'liga_mx']],
    ['Australia', ['australia', 'a_league']],
    ['Japan', ['japan', 'japanese']],
    ['South Korea', ['south_korea', 'korea']],
    ['China', ['china', 'chinese']],
    ['South America', ['south_america', 'conmebol']],
    ['Europe', ['europe', 'uefa']],
    ['World', ['world', 'international']],
  ];

  for (const [name, tokens] of countries) {
    if (tokens.some((token) => text.includes(token))) return name;
  }

  return 'World';
}

function flagEmoji(name: string) {
  const flags: Record<string, string> = {
    England: '🏴',
    Spain: '🇪🇸',
    Italy: '🇮🇹',
    Germany: '🇩🇪',
    France: '🇫🇷',
    Turkey: '🇹🇷',
    Argentina: '🇦🇷',
    Brazil: '🇧🇷',
    Belgium: '🇧🇪',
    Austria: '🇦🇹',
    Sweden: '🇸🇪',
    Netherlands: '🇳🇱',
    Portugal: '🇵🇹',
    USA: '🇺🇸',
    Australia: '🇦🇺',
    Japan: '🇯🇵',
    China: '🇨🇳',
    'South Korea': '🇰🇷',
    Europe: '🌍',
    'South America': '🌎',
    Asia: '🌏',
    Africa: '🌍',
    World: '🌐',
  };
  return flags[name] ?? '🌐';
}

export function TournamentPicker({ sport }: { sport: string }) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState('All');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const [timeCounts, setTimeCounts] = useState<Record<string, number>>({});

  const title = sportName(sport);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const res = await fetch(
          `/api/v1/leagues?sport=${encodeURIComponent(sport)}&limit=200`,
          { cache: 'no-store' },
        );

        const json = await res.json();
        const rows: League[] = json?.data?.leagues ?? [];

        if (!cancelled) {
          setLeagues(
            rows.filter((league) => Number(league.matchCount ?? 0) > 0),
          );
        }
      } catch {
        if (!cancelled) setLeagues([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, sport]);

  useEffect(() => {
    if (!open) return;

    const filter = TIME_FILTERS.find((item) => item.label === time);

    if (!filter || filter.hours === null) {
      setTimeCounts({});
      return;
    }
    const hours = filter.hours;

    let cancelled = false;

    async function loadTimeCounts() {
      try {
        const now = new Date();
        const to = new Date(
          now.getTime() + hours * 60 * 60 * 1000,
        );

        const counts: Record<string, number> = {};
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 20) {
          const params = new URLSearchParams({
            sport,
            page: String(page),
            pageSize: '50',
            from: now.toISOString(),
            to: to.toISOString(),
          });

          const response = await fetch(
            `/api/v1/matches?${params.toString()}`,
            { cache: 'no-store' },
          );

          if (!response.ok) break;

          const payload = await response.json();
          const data = payload?.data ?? payload;
          const items = Array.isArray(data?.items) ? data.items : [];

          for (const item of items) {
            const leagueId = String(item?.leagueId ?? '');
            if (!leagueId) continue;
            counts[leagueId] = (counts[leagueId] ?? 0) + 1;
          }

          hasMore = data?.hasMore === true;
          page += 1;

          if (items.length === 0) break;
        }

        if (!cancelled) {
          setTimeCounts(counts);
        }
      } catch {
        if (!cancelled) {
          setTimeCounts({});
        }
      }
    }

    void loadTimeCounts();

    return () => {
      cancelled = true;
    };
  }, [open, sport, time]);

  const filteredLeagues = useMemo(() => {
    const filter = TIME_FILTERS.find((item) => item.label === time);

    if (!filter || filter.hours === null) return leagues;

    return leagues
      .map((league) => ({
        ...league,
        matchCount: timeCounts[league.id] ?? 0,
      }))
      .filter((league) => Number(league.matchCount ?? 0) > 0);
  }, [leagues, time, timeCounts]);

  const countryRows = useMemo<Row[]>(() => {
    const groups = new Map<string, Row>();

    for (const league of filteredLeagues) {
      const name = inferCountry(league);
      const current = groups.get(name);

      if (current) {
        current.count += Number(league.matchCount ?? 0);
      } else {
        groups.set(name, {
          key: name,
          title: name,
          count: Number(league.matchCount ?? 0),
          logoUrl: null,
        });
      }
    }

    const priority = [
      'Europe',
      'England',
      'Spain',
      'Italy',
      'Germany',
      'France',
      'World',
      'South America',
      'Asia',
      'Africa',
      'Turkey',
      'Argentina',
      'Brazil',
    ];

    return Array.from(groups.values()).sort((a, b) => {
      const ai = priority.indexOf(a.title);
      const bi = priority.indexOf(b.title);

      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }

      return b.count - a.count;
    });
  }, [filteredLeagues]);

  const tournamentRows = useMemo<Row[]>(() => {
    return [...filteredLeagues]
      .sort((a, b) => {
        const count = Number(b.matchCount ?? 0) - Number(a.matchCount ?? 0);
        return count || a.nameEn.localeCompare(b.nameEn);
      })
      .map((league) => ({
        key: league.id,
        title: league.nameEn,
        count: Number(league.matchCount ?? 0),
        logoUrl: league.logoUrl,
        league,
      }));
  }, [filteredLeagues]);

  const rows = sport === 'football' || sport === 'soccer'
    ? country
      ? filteredLeagues
          .filter((league) => inferCountry(league) === country)
          .sort((a, b) => Number(b.matchCount ?? 0) - Number(a.matchCount ?? 0))
          .map((league) => ({
            key: league.id,
            title: league.nameEn,
            count: Number(league.matchCount ?? 0),
            logoUrl: league.logoUrl,
            league,
          }))
      : countryRows
    : tournamentRows;

  function close() {
    setOpen(false);
    setCountry(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCountry(null);
          setOpen(true);
        }}
        className="flex w-full items-center gap-2.5 rounded-[10px] bg-[#D9DDE5] px-4 py-2.5 text-left transition hover:bg-[#D2D6DF]"
      >
        <Trophy className="h-5 w-5 shrink-0 text-[#777F8B]" strokeWidth={2.2} />
        <span className="text-[15px] font-extrabold text-[#20242A]">
          Choose a tournament
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] bg-black/30"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="absolute inset-x-0 bottom-0 top-0 flex items-start justify-center sm:items-center">
            <div className="flex h-full w-full max-w-[720px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_20px_60px_rgba(0,0,0,.25)] sm:h-[calc(100%-32px)] sm:rounded-[28px]">
              <header className="relative shrink-0 px-5 pb-2 pt-5 text-center">
                <button
                  type="button"
                  onClick={close}
                  className="absolute left-4 top-5 grid h-10 w-10 place-items-center text-[#858C95]"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-8 w-8" strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  onClick={close}
                  className="absolute right-4 top-5 grid h-10 w-10 place-items-center text-[#858C95]"
                  aria-label="Close"
                >
                  <X className="h-8 w-8" strokeWidth={2.2} />
                </button>

                <div className="flex items-center justify-center gap-2">
                  <img
                    src={`/sports-new/svg/${sport}.svg`}
                    alt=""
                    className="h-9 w-9 object-contain"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                  <h2 className="text-[24px] font-black text-[#20242A]">
                    {country ?? title}
                  </h2>
                </div>

                <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-none">
                  {TIME_FILTERS.map((filter) => (
                    <button
                      key={filter.label}
                      type="button"
                      onClick={() => setTime(filter.label)}
                      className={`shrink-0 rounded-full px-5 py-2.5 text-[16px] font-extrabold transition ${
                        time === filter.label
                          ? 'bg-[#1677F0] text-white'
                          : 'bg-[#ECEEF2] text-[#20242A]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 pb-4">
                <div className="rounded-[18px] bg-[#EEF0F3]">
                  <Link
                    href={`/sports/${sport}`}
                    onClick={close}
                    className="mx-0 mb-3 flex min-h-[84px] items-center gap-4 rounded-[18px] bg-[#1677F0] px-5 text-white"
                  >
                    <span className="text-[31px] leading-none">🔥</span>
                    <span className="flex-1 text-[18px] font-black">Top</span>
                    <ChevronRight className="h-7 w-7" strokeWidth={2.4} />
                  </Link>

                  {loading ? (
                    <div className="px-5 py-12 text-center text-[14px] font-semibold text-[#8B929B]">
                      Loading…
                    </div>
                  ) : rows.length > 0 ? (
                    <div className="overflow-hidden rounded-b-[18px]">
                      {rows.map((row, index) => (
                        <div
                          key={row.key}
                          className={`min-h-[72px] ${
                            index > 0 ? 'border-t border-white' : ''
                          }`}
                        >
                          {row.league ? (
                            <Link
                              href={`/sports/${sport}/league/${row.league.id}`}
                              onClick={close}
                              className="flex min-h-[72px] items-center gap-4 px-5 transition hover:bg-[#E7E9ED]"
                            >
                              {row.logoUrl ? (
                                <img
                                  src={row.logoUrl}
                                  alt=""
                                  className="h-9 w-9 shrink-0 object-contain"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="grid h-9 w-9 shrink-0 place-items-center text-[25px]">
                                  🏆
                                </span>
                              )}

                              <span className="min-w-0 flex-1 truncate text-[17px] font-extrabold text-[#20242A]">
                                {row.title}
                              </span>

                              <span className="shrink-0 text-[16px] font-medium text-[#5E6670]">
                                {row.count}
                              </span>

                              <ChevronRight
                                className="h-6 w-6 shrink-0 text-[#5E6670]"
                                strokeWidth={2.4}
                              />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCountry(row.title)}
                              className="flex min-h-[72px] w-full items-center gap-4 px-5 text-left transition hover:bg-[#E7E9ED]"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center text-[27px]">
                                {flagEmoji(row.title)}
                              </span>

                              <span className="min-w-0 flex-1 text-[17px] font-extrabold text-[#20242A]">
                                {row.title}
                              </span>

                              <span className="shrink-0 text-[16px] font-medium text-[#5E6670]">
                                {row.count}
                              </span>

                              <ChevronRight
                                className="h-6 w-6 shrink-0 text-[#5E6670]"
                                strokeWidth={2.4}
                              />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-12 text-center text-[14px] font-semibold text-[#8B929B]">
                      No upcoming tournaments.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
