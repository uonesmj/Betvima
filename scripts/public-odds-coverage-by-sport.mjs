/**
 * Public, read-only BetVima live/pre-match odds coverage diagnostics.
 * Never sends credentials, places bets, stores full data or modifies the DB.
 * Counters are grouped per sport; unpriced fixtures are counted, not hidden.
 */
const ORIGIN = 'https://betvima.com';
const ROUTES = {
  live: '/api/v1/live?limit=100',
  upcoming: '/api/v1/matches?page=1&pageSize=100&live=false',
};
function openPrice(value) {
  const raw = String(value ?? '');
  return /^\d{1,18}$/.test(raw) && BigInt(raw) > 10_000n;
}
function summarize(label, data) {
  const matches = label === 'live' ? data.matches : data.items;
  const bySport = new Map();
  for (const match of Array.isArray(matches) ? matches : []) {
    const sport = String(match.sportKey || 'unknown');
    const row = bySport.get(sport) ?? { fixtures:0, pricedFixtures:0,
      validSelections:0, unavailable:0 };
    row.fixtures++;
    const valid = (match.topMarkets ?? []).flatMap(market =>
      !['open', 'active'].includes(market.status) ? [] :
        (market.selections ?? []).filter(selection =>
          ['open','active'].includes(selection.status) &&
          openPrice(selection.oddsScaled ?? selection.odds_scaled)));
    if(valid.length)row.pricedFixtures++;
    else row.unavailable++;
    row.validSelections+=valid.length;
    bySport.set(sport,row);
  }
  return [...bySport].sort(([a],[b])=>a.localeCompare(b))
    .map(([sport,metrics])=>({sport,...metrics}));
}
async function read(key) {
  const response = await fetch(ORIGIN+ROUTES[key],{
    headers:{accept:'application/json'},cache:'no-store',
    signal:AbortSignal.timeout(15000),redirect:'manual',
  });
  if(!response.ok)throw new Error(key+' HTTP '+response.status);
  const json = await response.json();
  return json.data ?? json;
}
const results=await Promise.allSettled(['live','upcoming'].map(async kind=>
  ({kind,groups:summarize(kind,await read(kind))})));
for(let i=0;i<results.length;i++){
  const x=results[i];console.log(JSON.stringify(x.status==='fulfilled'?x.value:
    {kind:['live','upcoming'][i],error:'Public feed unavailable: '+String(x.reason).slice(0,100)}));
}
if(results.some(x=>x.status==='rejected'))process.exitCode=1;
