'use client';

import { LiveMatchRefresh } from './live-match-refresh';
import { MatchHero } from './match-hero';

type Props = {
  matchId: string;
  initialMinute: number | null;
  initialPeriod: string | null;
  initialEvents: React.ComponentProps<typeof LiveMatchRefresh>['initialEvents'];
  initialStats: React.ComponentProps<typeof LiveMatchRefresh>['initialStats'];
  match: React.ComponentProps<typeof MatchHero>['match'];
  matchForDisplay: React.ComponentProps<typeof MatchHero>['matchForDisplay'];
  home: React.ComponentProps<typeof MatchHero>['home'];
  away: React.ComponentProps<typeof MatchHero>['away'];
  homeName: React.ComponentProps<typeof MatchHero>['homeName'];
  awayName: React.ComponentProps<typeof MatchHero>['awayName'];
  liveEvents: React.ComponentProps<typeof MatchHero>['liveEvents'];
  liveStats: React.ComponentProps<typeof MatchHero>['liveStats'];
  matchHistory: React.ComponentProps<typeof MatchHero>['matchHistory'];
};

export function LiveMatchCenterClient({
  matchId,
  initialMinute,
  initialPeriod,
  initialEvents,
  initialStats,
  match,
  matchForDisplay,
  home,
  away,
  homeName,
  awayName,
  liveEvents,
  liveStats,
  matchHistory,
}: Props) {
  return (
    <LiveMatchRefresh
      matchId={matchId}
      initialMinute={initialMinute}
      initialPeriod={initialPeriod}
      initialEvents={initialEvents}
      initialStats={initialStats}
    >
      {(live) => {
        const liveMatch = match.isLive
          ? {
              ...match,
              minute: live.minute,
              period: live.period,
              homeScore: live.homeScore ?? match.homeScore,
              awayScore: live.awayScore ?? match.awayScore,
            }
          : match;

        const liveMatchForDisplay =
          liveMatch.isLive && !matchForDisplay.isBettingAvailable
            ? { ...liveMatch, isBettingAvailable: false }
            : liveMatch;

        return (
          <MatchHero
            match={liveMatch}
            matchForDisplay={liveMatchForDisplay}
            home={home}
            away={away}
            homeName={homeName}
            awayName={awayName}
            liveEvents={live.events}
            liveStats={live.stats}
            matchHistory={matchHistory}
          />
        );
      }}
    </LiveMatchRefresh>
  );
}
