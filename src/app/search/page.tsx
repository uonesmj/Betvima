'use client';
import { useApp } from '@/components/layout/providers';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MatchCard, type MatchView } from '@/components/betting/match-card';
import { useSearchParams } from 'next/navigation';

type Match = {
  id: string;
  sportKey?: string;
  leagueName?: string;
  status?: string;
  scheduledAt?: string;
  startTime?: string;
  participants?: Array<{ role?: string; name?: string; imageUrl?: string }>;
  homeTeamName?: string;
  awayTeamName?: string;
  topMarkets?: any[];
  markets?: any[];
};

function team(match: Match, role: 'HOME' | 'AWAY') {
  const p = Array.isArray(match.participants)
    ? match.participants.find(x => String(x?.role ?? '').toUpperCase() === role)
    : undefined;
  return p?.name ?? (role === 'HOME' ? match.homeTeamName : match.awayTeamName) ?? '';
}

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d).replace(',', ' •');
}

function odds(match: Match) {
  const sources = [
    ...(Array.isArray(match.topMarkets) ? match.topMarkets : []),
    ...(Array.isArray(match.markets) ? match.markets : []),
  ];

  const values: string[] = [];

  const walk = (x: any) => {
    if (x == null || values.length >= 3) return;
    if (typeof x === 'number' && x > 1) {
      values.push(String(x));
      return;
    }
    if (typeof x === 'string' && /^[0-9]+([.][0-9]+)?$/.test(x) && Number(x) > 1) {
      values.push(x);
      return;
    }
    if (Array.isArray(x)) {
      for (const y of x) walk(y);
      return;
    }
    if (typeof x === 'object') {
      for (const key of ['price', 'odds', 'decimalOdds', 'value']) {
        if (x[key] != null) walk(x[key]);
      }
      if (values.length < 3) {
        for (const y of Object.values(x)) walk(y);
      }
    }
  };

  walk(sources);

  return [values[0] ?? '—', values[1] ?? '—', values[2] ?? '—'];
}

function toMatchView(match: Match): MatchView {
  return {
    id: match.id,
    sportKey: match.sportKey ?? "football",
    leagueId: (match as any).leagueId ?? null,
    leagueName: match.leagueName ?? null,
    leagueLogoUrl: (match as any).leagueLogoUrl ?? null,
    countryCode: (match as any).countryCode ?? null,
    status: match.status ?? "scheduled",
    scheduledAt: match.scheduledAt ?? match.startTime ?? new Date().toISOString(),
    minute: (match as any).minute ?? null,
    homeScore: (match as any).homeScore ?? null,
    awayScore: (match as any).awayScore ?? null,
    participants: Array.isArray(match.participants)
      ? match.participants.map((p: any) => ({
          teamId: p.teamId ?? "",
          role: String(p.role ?? "").toUpperCase(),
          name: p.name ?? "",
          logoUrl: p.logoUrl ?? p.imageUrl ?? null,
        }))
      : [],
    isLive: Boolean((match as any).isLive),
    isBettingAvailable: Boolean((match as any).isBettingAvailable),
    marketsCount: (match as any).marketsCount ?? match.markets?.length ?? 0,
    topMarkets: Array.isArray(match.topMarkets)
      ? match.topMarkets.map((m: any) => ({
          id: m.id,
          key: m.key ?? "",
          name: m.name ?? m.nameEn ?? m.nameFa ?? "",
          status: m.status ?? "open",
          selections: Array.isArray(m.selections)
            ? m.selections.map((sel: any) => ({
                id: sel.id,
                code: sel.code ?? "",
                name: sel.name ?? sel.nameEn ?? sel.nameFa ?? "",
                oddsScaled: String(sel.oddsScaled ?? "0"),
                previousOddsScaled: sel.previousOddsScaled == null ? null : String(sel.previousOddsScaled),
                status: sel.status ?? "open",
                movement: sel.movement,
                oddsVersion: Number(sel.oddsVersion ?? 0),
              }))
            : [],
        }))
      : [],
  };
}

function SearchPageContent() {
  const { t, dir } = useApp();
  const params = useSearchParams();
  const initial = params.get('searchQuery') ?? '';
  const [query, setQuery] = useState(initial);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(initial);
  }, [initial]);

  useEffect(() => {
    const q = initial.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/matches?q=${encodeURIComponent(q)}&page=1&pageSize=30`, {
      cache: 'no-store',
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const items = Array.isArray(data?.data?.items)
          ? data.data.items
          : Array.isArray(data?.items)
            ? data.items
            : [];
        setMatches(items);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initial]);

  const groups = useMemo(() => {
    const map = new Map<string, Match[]>();

    for (const match of matches) {
      const league = match.leagueName || 'Football';
      if (!map.has(league)) map.set(league, []);
      map.get(league)!.push(match);
    }

    return [...map.entries()];
  }, [matches]);

  function submitSearch() {
    const q = query.trim();
    window.location.href = q ? `/search?searchQuery=${encodeURIComponent(q)}` : '/search';
  }

  return (
    <main dir={dir} className="min-h-screen bg-[#e9eaee] pb-24 text-[#17191c]">
      <header className="h-[68px] bg-[#121212] px-5 flex items-center">
        <Link href="/" aria-label="BetVima" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#19c463] text-[#04140c] font-black">
            N
          </span>
          <span className="text-lg font-black tracking-wide text-white">BetVima</span>
        </Link>
      </header>

      <section className="mx-auto w-full max-w-[980px] px-5 pt-7">
        <div className="relative flex items-center justify-center mb-7">
          <Link
            href="/"
            className="absolute left-0 flex items-center gap-2 text-[16px] font-semibold"
          >
            <span className="text-2xl leading-none">‹</span>
            Back
          </Link>

          <h1 className="flex items-center gap-2 text-[24px] font-bold">
            <span className="text-[27px] leading-none">⌕</span>
            Search
          </h1>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            submitSearch();
          }}
          className="mb-7"
        >
          <div className="flex h-[62px] items-center rounded-[18px] border border-[#2187e9] bg-[#dfe2e9] px-5 shadow-[0_0_0_1px_rgba(33,135,233,.08)]">
            <span className="mr-4 text-[28px] leading-none text-[#737b8b]">⌕</span>

            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              aria-label={t("search.placeholder")}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[19px] outline-none placeholder:text-[#737b8b]"
            />

            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  window.history.replaceState({}, '', '/search');
                  setMatches([]);
                }}
                aria-label="Clear search"
                className="grid h-7 w-7 place-items-center rounded-full bg-[#7f8796] text-white text-sm"
              >
                ×
              </button>
            ) : null}
          </div>
        </form>

        {loading ? (
          <div className="py-12 text-center text-[#737b8b]">{t("search.searching")}</div>
        ) : groups.length === 0 ? (
          <div className="rounded-3xl bg-white px-6 py-14 text-center">
            <div className="text-xl font-bold">No matches found</div>
            <div className="mt-2 text-sm text-[#737b8b]">
              Try another team or league name.
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-4 flex items-center gap-3 text-[22px] font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#11b85b] text-white text-sm">
                31
              </span>
              Upcoming
            </h2>

            <div className="space-y-3">
              {groups.flatMap(([, leagueMatches]) =>
                leagueMatches.map((match) => (
                  <MatchCard key={match.id} match={toMatchView(match)} />
                ))
              )}
            </div>
          </>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-50 h-[76px] border-t border-white/10 bg-[#121212] text-white">
        <div className="mx-auto grid h-full max-w-[700px] grid-cols-5">
          {[
            ['☰', 'Menu', '/'],
            ['⌂', 'Home', '/'],
            ['$', 'Free money', '/'],
            ['⚽', 'Sports', '/sports/football'],
          ].map(([icon, label, href], i) => (
            <Link
              key={label}
              href={href ?? "/"}
              className={`flex flex-col items-center justify-center gap-1 text-[12px] font-semibold ${
                i === 4 ? 'text-[#198cf5]' : 'text-[#aeb4c0]'
              }`}
            >
              <span className="text-[25px] leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
