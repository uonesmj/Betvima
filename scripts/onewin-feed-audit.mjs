/**
 * READ-ONLY 1Win bookmaker coverage audit using the public Odds-API.io v3 contract.
 * Does not scrape 1win, mutate BetVima data, price bets, or grade settlements.
 * Usage: ODDS_API_IO_KEY=... node scripts/onewin-feed-audit.mjs
 * Optional: ONEWIN_LEAGUES=iran-persian-gulf-pro-league,turkey-super-lig
 *           ONEWIN_REFERENCE_JSON=/path/to/hand-reviewed-reference.json
 *           ONEWIN_REPORT_PATH=/path/to/report.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const API_ORIGIN = 'https://api.odds-api.io';
const BOOKMAKER = '1Win';
const TARGET_LEAGUES = /iran|turkey|turkiye|afghan|premier.league|champions.league/i;

export function normalizeName(value) {
  return String(value ?? '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export function extractMarkets(payload) {
  const books = payload?.bookmakers;
  const entry = books && typeof books === 'object'
    ? Object.entries(books).find(([name]) => normalizeName(name) === normalizeName(BOOKMAKER))
    : null;
  const raw = entry?.[1] ?? [];
  const markets = Array.isArray(raw) ? raw : Array.isArray(raw?.markets) ? raw.markets : [];
  return markets.filter((market) => market && typeof market.name === 'string').map((market) => ({
    name: market.name,
    updatedAt: typeof market.updatedAt === 'string' ? market.updatedAt : null,
    outcomes: Array.isArray(market.odds) ? market.odds.length : 0,
  }));
}

export function compareReference(reference, discovered, samples) {
  if (!Array.isArray(reference)) throw new TypeError('Reference must have an events array');
  const matchedIds = new Map();
  for (const event of discovered) {
    const home = normalizeName(event.home);
    const away = normalizeName(event.away);
    if (!home || !away) continue;
    const identity = home + '|' + away;
    if (!matchedIds.has(identity)) matchedIds.set(identity, []);
    matchedIds.get(identity).push(event);
  }
  const oddsById = new Map(samples.map((item) => [String(item.id), item]));
  const unmatched = [];
  const notSampled = [];
  const missingMarkets = [];
  let matched = 0;
  for (const item of reference) {
    const identity = normalizeName(item.home) + '|' + normalizeName(item.away);
    const candidates = matchedIds.get(identity) ?? [];
    const nearest = candidates.find((event) => {
      if (!item.date) return true;
      const expected = Date.parse(item.date);
      const actual = Date.parse(event.date);
      return Number.isFinite(expected) && Number.isFinite(actual) &&
        Math.abs(expected - actual) <= 2 * 60 * 60_000;
    });
    if (!nearest) {
      unmatched.push({ home: item.home, away: item.away, date: item.date ?? null });
      continue;
    }
    matched += 1;
    const sampled = oddsById.get(String(nearest.id));
    if (!sampled) {
      notSampled.push({ home: item.home, away: item.away });
      continue;
    }
    const required = Array.isArray(item.markets) ? item.markets : [];
    const offered = new Set(sampled.marketNames.map(normalizeName));
    const missing = required.filter((market) => !offered.has(normalizeName(market)));
    if (missing.length) missingMarkets.push({ home: item.home, away: item.away, markets: missing });
  }
  return { referenceEvents: reference.length, matched, missingEvents: unmatched,
    notSampledForMarketComparison: notSampled, missingMarkets };
}

function positiveInt(raw, defaultValue, ceiling) {
  const number = Number(raw);
  return Number.isInteger(number) && number > 0 ? Math.min(number, ceiling) : defaultValue;
}

function requestClient(apiKey, fetchImpl = fetch) {
  let calls = 0;
  return {
    count: () => calls,
    async get(path, params) {
      calls += 1;
      const url = new URL(path, API_ORIGIN);
      url.searchParams.set('apiKey', apiKey);
      for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
      }
      // Never include the URL in errors: it contains a secret query parameter.
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(12_000),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Odds API HTTP ' + response.status + ' on ' + path);
      return response.json();
    },
  };
}

export async function runAudit({
  apiKey, leagueSlugs = [], maxLeagues = 5, maxEvents = 15, reference = null,
  fetchImpl = fetch, now = Date.now(),
} = {}) {
  if (!apiKey) throw new Error('ODDS_API_IO_KEY is required. No requests were made.');
  const client = requestClient(apiKey, fetchImpl);
  const errors = [];
  const collected = new Map();
  const leaguesRaw = await client.get('/v3/leagues', { sport: 'football', all: 'true' });
  const leagues = asArray(leaguesRaw);
  const selected = leagueSlugs.length
    ? leagueSlugs.slice(0, maxLeagues)
    : leagues.filter((row) => TARGET_LEAGUES.test(String(row.name ?? '') + ' ' + String(row.slug ?? '')))
      .slice(0, maxLeagues).map((row) => row.slug).filter(Boolean);

  // A bookmaker filter limits the sampled feed; it does not establish parity with 1win.com.
  try {
    const live = asArray(await client.get('/v3/events/live', { sport: 'football', bookmaker: BOOKMAKER }));
    for (const event of live) if (event?.id != null) collected.set(String(event.id), event);
  } catch (error) {
    errors.push('live fixtures: ' + (error instanceof Error ? error.message : String(error)));
  }
  for (const league of selected) {
    try {
      const upcoming = asArray(await client.get('/v3/events', {
        sport: 'football', league, status: 'pending', bookmaker: BOOKMAKER, limit: 50,
      }));
      for (const event of upcoming) if (event?.id != null) collected.set(String(event.id), event);
    } catch (error) {
      errors.push('fixtures in ' + league + ': ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  const discovered = [...collected.values()];
  // Prefer live first. No API key or financial records are included in output.
  const chosen = discovered.sort((a, b) =>
    Number(b.status === 'live') - Number(a.status === 'live') ||
    String(a.date ?? '').localeCompare(String(b.date ?? ''))).slice(0, maxEvents);

  const samples = [];
  for (const event of chosen) {
    let markets = [];
    let error = null;
    try {
      const odds = await client.get('/v3/odds', { eventId: event.id, bookmakers: BOOKMAKER });
      markets = extractMarkets(odds);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      errors.push('odds event ' + event.id + ': ' + error);
    }
    const ages = markets.map((market) => market.updatedAt ? now - Date.parse(market.updatedAt) : NaN);
    samples.push({
      id: event.id, home: event.home ?? null, away: event.away ?? null,
      league: event.league?.name ?? null, status: event.status ?? null,
      scheduledAt: event.date ?? null, scoreAvailable: event.scores != null,
      markets: markets.length, marketNames: markets.map((market) => market.name),
      missingMarketTimestamps: ages.filter((age) => !Number.isFinite(age)).length,
      liveMarketsLastPriceChangeOver60s: event.status === 'live'
        ? ages.filter((age) => Number.isFinite(age) && age > 60_000).length : null,
      error,
    });
  }
  const liveSamples = samples.filter((item) => item.status === 'live');
  return {
    generatedAt: new Date(now).toISOString(), feed: 'Odds-API.io / 1Win',
    purpose: 'READ_ONLY_EVALUATION', sportsbookLiveEnabled: false,
    requiresWrittenCommercialAuthorization: true,
    bookmakerParityVerified: false,
    incidents: 'NOT_VERIFIED: score fields are not an incident timeline (goals, cards, VAR, subs)',
    providerClaims: { footballMarketTypes: 21, playerProps: false },
    requests: client.count(), discoveredFixtures: discovered.length,
    sampledFixtures: samples.length, sampledLiveFixtures: liveSamples.length,
    sampledLiveWithoutScore: liveSamples.filter((item) => !item.scoreAvailable).length,
    leaguesInspected: selected, errors, samples,
    referenceComparison: reference ? compareReference(reference, discovered, samples) : null,
    limitations: [
      'This is a bounded sample, not the full 1Win catalogue.',
      'No event-by-event parity claim without independently observed reference fixtures and markets.',
      'A market updatedAt indicates the last price change, not the last time the feed was checked.',
      'No incident feed, settlement guarantees, streaming latency or legal licence is proved by this audit.',
      'Do not connect this code to BetVima betting, wallet or settlement.',
    ],
  };
}

async function main() {
  const apiKey = process.env.ODDS_API_IO_KEY;
  const leagueSlugs = String(process.env.ONEWIN_LEAGUES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const referencePath = process.env.ONEWIN_REFERENCE_JSON;
  const raw = referencePath ? JSON.parse(await readFile(referencePath, 'utf8')) : null;
  const reference = raw ? raw.events : null;
  const report = await runAudit({
    apiKey, leagueSlugs,
    maxLeagues: positiveInt(process.env.ONEWIN_MAX_LEAGUES, 5, 12),
    maxEvents: positiveInt(process.env.ONEWIN_MAX_EVENTS, 15, 40),
    reference,
  });
  if (process.env.ONEWIN_REPORT_PATH) {
    await writeFile(process.env.ONEWIN_REPORT_PATH, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Never log request URLs or credentials.
    console.error('1Win evaluation failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
