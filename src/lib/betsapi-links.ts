/** Bet365 event route with source fixture identity, never a wagerable match UUID. */
type FixtureMeta = {
  scheduledAt?: string | null;
  participants?: Array<{ role: string; name: string }>;
};
export function sportsbookMatchHref(matchId: string, fixture?: FixtureMeta): string {
  const match = /^betsapi:(live|upcoming):(\d{1,4}):(\d{1,16})$/.exec(matchId);
  if (match) {
    const p = new URLSearchParams({ mode:match[1]!, sportId:match[2]! });
    const home = fixture?.participants?.find(x=>x.role==='HOME')?.name?.slice(0,140);
    const away = fixture?.participants?.find(x=>x.role==='AWAY')?.name?.slice(0,140);
    if(home&&away&&fixture?.scheduledAt){
      p.set('home',home);p.set('away',away);p.set('kickoff',fixture.scheduledAt);
    }
    return '/event/'+match[3]+'?'+p.toString();
  }
  return '/match/'+encodeURIComponent(matchId);
}
