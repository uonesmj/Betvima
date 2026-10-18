/** External BetsAPI identifiers only open a read-only Bet365 event page. */
export function sportsbookMatchHref(matchId: string): string {
  const match = /^betsapi:(live|upcoming):(\d{1,4}):(\d{1,16})$/.exec(matchId);
  if (match) {
    return `/event/${match[3]}?mode=${match[1]}&sportId=${match[2]}`;
  }
  return `/match/${encodeURIComponent(matchId)}`;
}
