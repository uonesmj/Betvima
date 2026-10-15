import { MatchCard, type MatchView } from './match-card';

/** Top Bets shares the exact same native-inspired fixture layout as every
 * other sportsbook surface. Only betting availability may differ by mode. */
export function TopBetCard({
  match, liveEnabled = false,
}: { match: MatchView; liveEnabled?: boolean }) {
  const display = match.isLive && !liveEnabled
    ? { ...match, isBettingAvailable: false } : match;
  return (
    <div data-testid="top-bet-card" data-match-id={match.id}>
      <MatchCard match={display}/>
    </div>
  );
}
