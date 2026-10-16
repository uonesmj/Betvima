/**
 * PUBLIC READ-ONLY BetVima odds monitoring. Never logs user/session/wallet data,
 * requests a signed quote, places a bet, or changes provider configurations.
 */
const base = 'https://betvima.com';
const pause = Number(process.env.LIVE_SMOKE_WAIT_MS ?? '25000');
const paths = {
  live: '/api/v1/live?limit=100',
  upcoming: '/api/v1/matches?live=false&page=1&pageSize=50',
  health: '/api/health',
};
const numberLike = value => /^\d{1,18}$/.test(String(value ?? '')) &&
  BigInt(value) > 10_000n;
const safeEntries = x => Array.isArray(x) ? x : [];
async function read(path) {
  const r = await fetch(base + path, { cache: 'no-store',headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(18000) });
  if (!r.ok) throw new Error('Public endpoint HTTP '+r.status);
  const data = await r.json();
  return data.data ?? data;
}
const summarize = (kind, data) => {
  const matches = safeEntries(kind === 'live' ? data.matches : data.items);
  const prices = new Map();
  let priced=0, football=0, displayed=0, actionable=0;
  for (const fixture of matches) {
    football += String(fixture.sportKey ?? '').toLowerCase() === 'football' ? 1 : 0;
    const markets=safeEntries(fixture.topMarkets ?? fixture.top_markets);
    let matchPrices=0;
    for(const market of markets) for(const option of safeEntries(market.selections)) {
      displayed++;
      if (numberLike(option.oddsScaled ?? option.odds_scaled)) {
        matchPrices++;
        prices.set(String(option.id ?? ''),{
          price:String(option.oddsScaled ?? option.odds_scaled),
          revision:String(option.oddsVersion ?? option.odds_version ?? ''),
          marketStatus:market.status, selectionStatus:option.status,
        });
        if (fixture.isBettingAvailable && market.status === 'open' && option.status === 'open')
          actionable++;
      }
    }
    if(matchPrices>0)priced++;
  }
  return { matchCount:matches.length, football, pricedMatches:priced,
    availablePriceSelections:prices.size, shownSelections:displayed,
    actionableDisplaySelections:actionable, prices,
    providerConfigured: kind === 'live' ? data.providerConfigured : undefined,
    liveBettingEnabled: kind === 'live' ? data.liveBettingEnabled : undefined,
    catalogueUnavailable: kind === 'live' ? data.catalogueUnavailable : undefined };
};
function compare(a,b) {
  let shared=0,moved=0,revisionBumped=0,retired=0,appeared=0;
  for(const [key,x] of a.prices) {
    const y=b.prices.get(key);
    if(!y) { retired++; continue; }
    shared++;
    if(x.price!==y.price) moved++;
    if(x.revision!==y.revision)revisionBumped++;
  }
  for(const key of b.prices.keys())if(!a.prices.has(key))appeared++;
  return { commonSelections:shared,priceChanges:moved,revisionChanges:revisionBumped,
    disappeared:retired,appeared,conclusion:moved>0?
      'At least one public price changed during observation' :
      'No price movement witnessed. This does not establish a stale provider feed.'};
}
const publicView = snap => {
  const { prices, ...rest } = snap;
  return rest;
};
async function run() {
  const [l1,u1,h]=await Promise.all([read(paths.live),read(paths.upcoming),read(paths.health)]);
  const a=summarize('live',l1),b=summarize('upcoming',u1);
  console.log(JSON.stringify({phase:'first',live:publicView(a),upcoming:publicView(b),
    health:h.status, checks:safeEntries(h.checks)
      .filter(x=>['sports_provider','workers','database'].includes(x.name))
      .map(x=>({name:x.name,status:x.status}))}));
  await new Promise(resolve=>setTimeout(resolve,pause));
  const [l2,u2]=await Promise.all([read(paths.live),read(paths.upcoming)]);
  const c=summarize('live',l2),d=summarize('upcoming',u2);
  console.log(JSON.stringify({phase:'second',live:publicView(c),upcoming:publicView(d),
    observationMilliseconds:pause, liveDifference:compare(a,c),upcomingDifference:compare(b,d)}));
  if(!a.availablePriceSelections&&!b.availablePriceSelections&&!c.availablePriceSelections&&!d.availablePriceSelections)
    process.exitCode=2;
}
run().catch(error=>{console.error(JSON.stringify({smoke:'failed',reason:error.message}));
  process.exitCode=1;});
