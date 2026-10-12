'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MatchCard, type MatchView } from './match-card';
import { LeagueLogo } from '@/components/ui/logo';
import { isLiveMatchStatus } from '@/lib/match-state';

function sportLabel(sportKey: string) {
  const labels: Record<string, string> = {
    football: 'Football',
    basketball: 'Basketball',
    tennis: 'Tennis',
    volleyball: 'Volleyball',
    'ice-hockey': 'Ice Hockey',
    hockey: 'Ice Hockey',
    'table-tennis': 'Table Tennis',
    'ice_hockey': 'Ice Hockey',
    baseball: 'Baseball',
    handball: 'Handball',
    cricket: 'Cricket',
    boxing: 'Boxing',
    mma: 'MMA',
    'american-football': 'American Football',
    esports: 'Esports',
  };
  return labels[sportKey] ?? sportKey.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupByLeague(matches: MatchView[]) {
  const groups = new Map<string, MatchView[]>();

  for (const match of matches) {
    const key = `${match.leagueId ?? match.leagueName ?? match.sportKey}::${match.countryCode ?? ''}`;
    const current = groups.get(key) ?? [];
    current.push(match);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, items]) => {
    const sorted = [...items].sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() -
        new Date(b.scheduledAt).getTime(),
    );

    return {
      key,
      title: sorted[0]?.leagueName ?? sorted[0]?.sportKey ?? 'Football',
      country: sorted[0]?.countryCode ?? null,
      logo: sorted[0]?.leagueLogoUrl ?? null,
      sportKey: sorted[0]?.sportKey ?? 'football',
      matches: sorted,
    };
  });
}

export function MatchListClient({
  matches,
  liveEnabled = false,
  livePage = false,
}: {
  matches: MatchView[];
  liveEnabled?: boolean;
  livePage?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [liveMatches, setLiveMatches] = useState<MatchView[]>(matches);
  const liveMatchesRef = useRef<MatchView[]>(matches);

  useEffect(() => {
    if (!livePage) {
      liveMatchesRef.current = matches;
      setLiveMatches(matches);
      return;
    }

    setLiveMatches((current) => {
      const incomingIds = new Set(matches.map((match) => match.id));
      const currentIds = new Set(current.map((match) => match.id));

      if (
        incomingIds.size === currentIds.size &&
        matches.every((match) => currentIds.has(match.id)) &&
        current.every((match) => incomingIds.has(match.id))
      ) {
        liveMatchesRef.current = current;
        return current;
      }

      liveMatchesRef.current = matches;
      return matches;
    });
  }, [matches, livePage]);

  useEffect(() => {
    if (livePage) return;

    let cancelled = false;
    const timers = new Map<string, number>();

    const pollInterval = (matchId: string) => {
      let hash = 0;
      for (let i = 0; i < matchId.length; i += 1) {
        hash = (hash * 31 + matchId.charCodeAt(i)) >>> 0;
      }
      return 5000 + (hash % 3000);
    };

    const initialDelay = (matchId: string) => {
      let hash = 0;
      for (let i = 0; i < matchId.length; i += 1) {
        hash = (hash * 17 + matchId.charCodeAt(i)) >>> 0;
      }
      return 500 + (hash % 3500);
    };

    const refreshMatch = async (matchId: string) => {
      if (cancelled) return;

      const match = liveMatchesRef.current.find((item) => item.id === matchId);
      if (
        !match ||
        match.isLive ||
        isLiveMatchStatus(String(match.status).toLowerCase())
      ) {
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(
          `/api/v1/matches/${match.id}/odds?ts=${Date.now()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok || cancelled) return;

        const payload = await response.json();
        const data = payload?.data ?? payload;

        if (cancelled || !Array.isArray(data?.markets)) return;

        const nextMarkets: MatchView["topMarkets"] = data.markets.map(
          (market: any) => ({
            id: String(market.id),
            key: market.key ?? "",
            name: market.name ?? market.key ?? "",
            status: market.status ?? "open",
            specifier:
              market.specifier == null ? null : String(market.specifier),
            selections: Array.isArray(market.selections)
              ? market.selections.map((selection: any) => ({
                  id: String(selection.id),
                  code: selection.code ?? "",
                  name: selection.name ?? selection.code ?? "",
                  oddsScaled: String(selection.oddsScaled ?? "0"),
                  previousOddsScaled:
                    selection.previousOddsScaled == null
                      ? null
                      : String(selection.previousOddsScaled),
                  status: selection.status ?? "open",
                  movement:
                    selection.previousOddsScaled == null ||
                    String(selection.previousOddsScaled) ===
                      String(selection.oddsScaled ?? "0")
                      ? "STABLE"
                      : Number(selection.oddsScaled ?? 0) >
                          Number(selection.previousOddsScaled ?? 0)
                        ? "UP"
                        : "DOWN",
                  oddsVersion: Number(selection.version ?? 0),
                }))
              : [],
          }),
        );

        if (!nextMarkets || !nextMarkets.some((market) => market.selections.length > 0)) {
          return;
        }

        const updatedMatch: MatchView = {
          ...match,
          status: data.status ?? match.status,
          minute: data.minute ?? match.minute,
          homeScore: data.homeScore ?? match.homeScore,
          awayScore: data.awayScore ?? match.awayScore,
          isLive:
            isLiveMatchStatus(String(data.status ?? match.status).toLowerCase()) ||
            match.isLive,
          topMarkets: nextMarkets,
        };

        setLiveMatches((current) => {
          const next = current.map((item) =>
            item.id === updatedMatch.id ? updatedMatch : item,
          );
          liveMatchesRef.current = next;
          return next;
        });
      } catch {
        // Ignore individual polling failures.
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const schedule = (matchId: string, delay: number) => {
      if (cancelled) return;

      const timer = window.setTimeout(async () => {
        if (cancelled) return;

        await refreshMatch(matchId);

        if (!cancelled) {
          schedule(matchId, pollInterval(matchId));
        }
      }, delay);

      timers.set(matchId, timer);
    };

    const targets = liveMatchesRef.current.filter(
      (match) =>
        !match.isLive &&
        !isLiveMatchStatus(String(match.status).toLowerCase()),
    );

    for (const match of targets) {
      schedule(match.id, initialDelay(match.id));
    }

    return () => {
      cancelled = true;
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, [livePage, matches]);

  useEffect(() => {
    if (!livePage || !liveEnabled) return;

    let cancelled = false;
    const timers = new Map<string, number>();

    const getPollInterval = (matchId: string) => {
      let hash = 0;
      for (let i = 0; i < matchId.length; i += 1) {
        hash = (hash * 31 + matchId.charCodeAt(i)) >>> 0;
      }
      return 3000 + (hash % 2000);
    };

    const getInitialDelay = (matchId: string) => {
      let hash = 0;
      for (let i = 0; i < matchId.length; i += 1) {
        hash = (hash * 17 + matchId.charCodeAt(i)) >>> 0;
      }
      return 300 + (hash % 3200);
    };

    const refreshOneLiveMatch = async (matchId: string) => {
      if (cancelled) return;

      const match = liveMatchesRef.current.find((item) => item.id === matchId);

      if (
        !match ||
        (!match.isLive && !isLiveMatchStatus(String(match.status).toLowerCase()))
      ) {
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(
          `/api/v1/matches/${match.id}/odds?live=1&ts=${Date.now()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );

        if (!response.ok || cancelled) return;

        const payload = await response.json();
        const data = payload?.data ?? payload;

        if (cancelled) return;

        const nextMarkets = Array.isArray(data?.markets)
          ? data.markets.map((market: any) => ({
              id: String(market.id),
              key: market.key ?? '',
              name: market.name ?? market.key ?? '',
              status: market.status ?? 'open',
              specifier:
                market.specifier == null
                  ? null
                  : String(market.specifier),
              selections: Array.isArray(market.selections)
                ? market.selections.map((selection: any) => ({
                    id: String(selection.id),
                    code: selection.code ?? '',
                    name: selection.name ?? selection.code ?? '',
                    oddsScaled: String(selection.oddsScaled ?? '0'),
                    previousOddsScaled:
                      selection.previousOddsScaled == null
                        ? null
                        : String(selection.previousOddsScaled),
                    status: selection.status ?? 'open',
                    movement: (() => {
                      const nextOdds = String(selection.oddsScaled ?? '0');
                      const providerPrevious =
                        selection.previousOddsScaled == null
                          ? null
                          : String(selection.previousOddsScaled);

                      if (
                        providerPrevious == null ||
                        providerPrevious === nextOdds
                      ) {
                        return 'STABLE';
                      }

                      const prev = Number(providerPrevious);
                      const next = Number(nextOdds);

                      return next > prev
                        ? 'UP'
                        : next < prev
                          ? 'DOWN'
                          : 'STABLE';
                    })(),
                    oddsVersion: Number(selection.version ?? 0),
                  }))
                : [],
            }))
          : null;

        const updatedMatch: MatchView = {
          ...match,
          status: data.status ?? match.status,
          minute: data.minute ?? match.minute,
          homeScore: data.homeScore ?? match.homeScore,
          awayScore: data.awayScore ?? match.awayScore,
          isLive:
            isLiveMatchStatus(String(data.status ?? match.status).toLowerCase()) ||
            match.isLive,
          ...(nextMarkets
            ? { topMarkets: nextMarkets }
            : {}),
        };

        setLiveMatches((current) => {
          const next = current.map((item) =>
            item.id === updatedMatch.id ? updatedMatch : item,
          );

          liveMatchesRef.current = next;
          return next;
        });
      } catch {
        // Individual live-match polling failures are intentionally isolated.
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const scheduleMatch = (matchId: string, delay: number) => {
      if (cancelled) return;

      const timer = window.setTimeout(async () => {
        if (cancelled) return;

        await refreshOneLiveMatch(matchId);

        if (!cancelled) {
          scheduleMatch(matchId, getPollInterval(matchId));
        }
      }, delay);

      timers.set(matchId, timer);
    };

    const liveTargets = liveMatchesRef.current.filter(
      (match) =>
        match.isLive ||
        isLiveMatchStatus(String(match.status).toLowerCase()),
    );

    for (const match of liveTargets) {
      scheduleMatch(match.id, getInitialDelay(match.id));
    }

    return () => {
      cancelled = true;

      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }

      timers.clear();
    };
  }, [livePage, liveEnabled, matches]);

  const visible = useMemo(
    () =>
      liveEnabled
        ? liveMatches
        : liveMatches.map((match) =>
            match.isLive
              ? { ...match, isBettingAvailable: false }
              : match,
          ),
    [liveMatches, liveEnabled],
  );

  const groups = useMemo(() => groupByLeague(visible), [visible]);

  const toggleGroup = (key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E1E4E8] bg-white px-5 py-12 text-center text-sm text-[#8A9099]">
        {livePage ? 'No live events right now.' : 'No events found.'}
      </div>
    );
  }

  return (
    <div className="space-y-2.5" data-testid="match-list">


      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);

        return (
          <section
            key={group.key}
            data-testid="league-group"
            className="overflow-hidden rounded-[16px] border border-[#E1E5EA] bg-white shadow-[0_2px_10px_rgba(15,23,42,.035)]"
          >
            <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-[#E8EAED] bg-white px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[#E6E9ED] bg-[#F7F8FA]">
                  <LeagueLogo
                    url={group.logo}
                    name={group.title}
                    sportKey={group.sportKey}
                    size={24}
                  />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-[12px] font-black leading-4 text-[#20242A]">
                    {group.title}
                  </h2>
                  <p className="mt-0.5 truncate text-[10px] font-medium leading-4 text-[#9298A1]">
                    {group.country || sportLabel(group.sportKey)}{' '}
          · {group.matches.length} events
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.title}`}
                aria-expanded={!isCollapsed}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4E7EB] bg-white text-[#69717B] transition hover:bg-[#F5F6F8]"
              >
                <span
                  className={`text-[18px] leading-none transition-transform ${
                    isCollapsed ? 'rotate-180' : ''
                  }`}
                >
                  ⌃
                </span>
              </button>
            </header>

            {!isCollapsed ? (
              <div className="divide-y divide-[#ECEEF1]">
                {group.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    compact
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
