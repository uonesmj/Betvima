export type LiveEventMarker = { x: number; y: 50; side: 'home' | 'away' };

/** Only identify a team's half when the provider event explicitly names that team. */
export function getLiveEventMarker(
  eventTeamId: string | null | undefined,
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
): LiveEventMarker | null {
  if (!eventTeamId) return null;
  if (homeTeamId && eventTeamId === homeTeamId) return { x: 65, y: 50, side: 'home' };
  if (awayTeamId && eventTeamId === awayTeamId) return { x: 35, y: 50, side: 'away' };
  return null;
}
