/** Approved competition shortcut order, shared by the website Home ribbon. */
export type HomeCompetition = {
  label: string;
  sportHref: string;
  accessibleDestination: string;
};
export const HOME_COMPETITIONS: readonly HomeCompetition[] = [
  { label: 'WNBA', sportHref: '/sports/basketball', accessibleDestination: 'basketball events' },
  { label: 'UFC Fight Night', sportHref: '/sports/mma', accessibleDestination: 'MMA events' },
  { label: 'WTA Wuhan', sportHref: '/sports/tennis', accessibleDestination: 'tennis events' },
  { label: 'Markets', sportHref: '/topbets', accessibleDestination: 'top bets' },
  { label: 'NBA Pre-season', sportHref: '/sports/basketball', accessibleDestination: 'basketball events' },
  { label: 'USA Grand Prix', sportHref: '/live', accessibleDestination: 'all live events' },
  { label: 'NFL', sportHref: '/sports/american-football', accessibleDestination: 'American football events' },
  { label: 'MLB', sportHref: '/sports/baseball', accessibleDestination: 'baseball events' },
  { label: 'Setka Cup', sportHref: '/sports/table-tennis', accessibleDestination: 'table tennis events' },
  { label: 'CyberFIFA', sportHref: '/sports/esports', accessibleDestination: 'esports events' },
  { label: 'Eurocup', sportHref: '/sports/basketball', accessibleDestination: 'basketball events' },
  { label: 'NBA Replays', sportHref: '/sports/basketball', accessibleDestination: 'basketball events' },
  { label: 'Euroleague', sportHref: '/sports/basketball', accessibleDestination: 'basketball events' },
  { label: 'ATP Shanghai', sportHref: '/sports/tennis', accessibleDestination: 'tennis events' },
  { label: 'Conference League', sportHref: '/sports/football', accessibleDestination: 'football events' },
  { label: 'Europa League', sportHref: '/sports/football', accessibleDestination: 'football events' },
] as const;

export function competitionSprite(index: number): { image: string; offsetX: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HOME_COMPETITIONS.length) {
    throw new Error('Unknown Home competition shortcut');
  }
  // Atlas rows consist of four 112-pixel thumbnails from the approved Android assets.
  // Crop 16 pixels from the perimeter for a consistent 80-pixel circular badge.
  return { image: `/brand/league-shortcuts/row-${Math.floor(index / 4)}.webp`,
    offsetX: -(index % 4) * 112 - 16 };
}
