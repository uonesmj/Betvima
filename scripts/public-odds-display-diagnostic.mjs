/**
 * Read-only, no-login production *display* diagnostic.
 * No bets, user data, wallet reads, external odds purchases or server writes.
 */
const base = 'https://betvima.com';
const endpoints = [
  ['/api/v1/live?limit=100', 'live'],
  ['/api/v1/matches?live=false&pageSize=50', 'upcoming'],
  ['/api/health', 'health'],
];

async function check(path, kind) {
  const record = { endpoint: kind, httpStatus: null, ok: false };
  try {
    const response = await fetch(base + path, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
      redirect: 'manual',
    });
    record.httpStatus = response.status;
    if (!response.ok) {
      record.issue = 'unavailable_http_response';
      return record;
    }
    const json = await response.json();
    const data = json?.data ?? json;
    record.ok = true;
    if (kind === 'health') {
      record.healthStatus = data?.status ?? null;
      record.checks = Array.isArray(data?.checks) ?
        data.checks.filter((r) => ['sports_provider','workers','database'].includes(r.name))
          .map((r) => ({ name: r.name, status: r.status })) : [];
    } else {
      const matches = kind === 'live' ?
        (Array.isArray(data?.matches) ? data.matches : []) :
        (Array.isArray(data?.items) ? data.items : []);
      record.matchCount = matches.length;
      record.footballCount = matches.filter((m) => String(m.sportKey ?? '').toLowerCase() === 'football').length;
      const marketSummaries = matches.map((m) => m.topMarkets ?? m.top_markets ?? []).flat();
      const selections = marketSummaries.flatMap((m) => m?.selections ?? []);
      record.matchesWithDisplayMarkets = matches.filter((m) =>
        (m.topMarkets ?? m.top_markets ?? []).some((market) =>
          (market.selections ?? []).length > 0)).length;
      record.marketCount = marketSummaries.length;
      record.selectionCount = selections.length;
      record.openSelections = selections.filter((s) => s?.status === 'open' &&
        /^(?:[1-9]\d{0,17})$/.test(String(s?.oddsScaled ?? s?.odds_scaled ?? '')) &&
        BigInt(String(s.oddsScaled ?? s.odds_scaled)) > 10000n).length;
      if (kind === 'live') {
        record.providerConfigured = data?.providerConfigured ?? null;
        record.liveBettingEnabled = data?.liveBettingEnabled ?? null;
        record.catalogueUnavailable = data?.catalogueUnavailable ?? null;
      }
      record.note = 'The public endpoints may truncate/omit markets; no bet-price freshness conclusion from HTTP alone.';
    }
  } catch (error) {
    record.issue = error instanceof SyntaxError ? 'non_json_response' :
      error instanceof Error && error.name === 'TimeoutError' ? 'request_timeout' : 'request_failed';
  }
  return record;
}
for (const [path,kind] of endpoints) {
  process.stdout.write(JSON.stringify(await check(path,kind)) + '\n');
}
