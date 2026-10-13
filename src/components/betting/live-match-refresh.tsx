'use client';

import { useEffect, useState } from 'react';

type LiveEvent = {
  id: string;
  type: string;
  minute: number | null;
  period: string | null;
  teamId?: string | null;
  teamName?: string | null;
  playerName: string | null;
  detail: string | null;
};

type LiveStats = {
  provider: string | null;
  updatedAt: string;
  payload: unknown;
};

type Props = {
  matchId: string;
  initialMinute: number | null;
  initialPeriod: string | null;
  initialEvents: LiveEvent[];
  initialStats: LiveStats | null;
  children: (data: {
    minute: number | null;
    period: string | null;
    homeScore: number | null;
    awayScore: number | null;
    events: LiveEvent[];
    stats: LiveStats | null;
  }) => React.ReactNode;
};

export function LiveMatchRefresh({
  matchId,
  initialMinute,
  initialPeriod,
  initialEvents,
  initialStats,
  children,
}: Props) {
  const [data, setData] = useState({
    minute: initialMinute,
    period: initialPeriod,
    homeScore: null as number | null,
    awayScore: null as number | null,
    events: initialEvents,
    stats: initialStats,
  });

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/v1/matches/${matchId}?liveOnly=true`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) return;

        const json = await response.json();
        const payload = json?.data ?? json;

        if (!active || !payload?.match) return;

        const minute = payload.match.minute ?? null;
        const period = payload.match.period ?? null;

        setData({
          minute,
          period,
          homeScore: payload.match.homeScore ?? null,
          awayScore: payload.match.awayScore ?? null,
          events: Array.isArray(payload.liveEvents) ? payload.liveEvents : [],
          stats: payload.liveStats ?? null,
        });

        // React rerenders the minute and phase from the verified provider
        // snapshot. Do not replace them through document-wide DOM mutations.

      } catch {
        // Keep the last known live snapshot on transient network errors.
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 15_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [matchId]);

  return <>{children(data)}</>;
}
