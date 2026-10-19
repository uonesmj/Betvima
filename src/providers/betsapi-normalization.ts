/**
 * Source-specific normalization for BetsAPI Events API (NOT Bet365 FI).
 *
 * No source ID or market identifier is shared with The Odds API. This file is
 * safe for offline fixtures and never grants permission to wager.
 */
import type {
  ProviderMatch, ProviderOddsBundle, ProviderOddsMarket, ProviderOddsSelection,
  ProviderResultSnapshot,
} from '@/lib/ports/providers';
import { isSaneOdds, oddsFromDecimalString } from '@/domain/odds';

export const BETSAPI_SPORTS = [
  { id: 1, slug: 'football' }, { id: 18, slug: 'basketball' },
  { id: 13, slug: 'tennis' }, { id: 91, slug: 'volleyball' },
  { id: 17, slug: 'ice-hockey' }, { id: 3, slug: 'cricket' },
  { id: 78, slug: 'handball' },
] as const;

export const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
export const string = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const integer = (value: unknown): number | null => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
};
const field = (obj: unknown, key: string) => object(obj)[key];
const timestamp = (value: unknown): string | null => {
  const sec = integer(value);
  if (!sec || sec < 1_500_000_000 || sec > 4_102_444_800) return null;
  return new Date(sec * 1000).toISOString();
};
export const betsapiIdentity = (sportId: number, eventId: string) =>
  `${sportId}:${eventId}`;
export function parseBetsapiIdentity(id: string) {
  const match = /^(\d{1,3}):(\d{1,16})$/.exec(id);
  if (!match) return null;
  const sportId = Number(match[1]);
  if (!BETSAPI_SPORTS.some(s => s.id === sportId)) return null;
  return { sportId, eventId: match[2]! };
}

export function normalizeBetsapiEvent(value: unknown): ProviderMatch | null {
  const row = object(value);
  const sportId = integer(row.sport_id);
  const config = BETSAPI_SPORTS.find(s => s.id === sportId);
  const eventId = string(row.id);
  const scheduledAt = timestamp(row.time);
  const home = string(field(row.home, 'name')).trim().slice(0, 150);
  const away = string(field(row.away, 'name')).trim().slice(0, 150);
  if (!config || !/^\d{1,16}$/.test(eventId) || !scheduledAt || !home || !away) return null;
  const statusNumber = integer(row.time_status);
  if (![0, 1, 2, 3, 4, 5].includes(statusNumber ?? -1)) return null;
  const parts = /^([0-9]{1,3})-([0-9]{1,3})$/.exec(string(row.ss));
  const timer = integer(field(row.timer, 'tm'));
  const status = statusNumber === 0 ? 'scheduled'
    : statusNumber === 1 ? 'live'
    : statusNumber === 3 ? 'finished'
    : 'suspended';
  return {
    providerId: betsapiIdentity(config.id, eventId),
    sport: config.slug,
    leagueProviderId: `betsapi:${string(field(row.league, 'id')) || 'unknown'}`,
    leagueName: string(field(row.league, 'name')) || null,
    countryCode: string(field(row.league, 'cc')) || null,
    homeTeamName: home, awayTeamName: away, scheduledAt,
    status,
    homeScore: parts ? Number(parts[1]) : null,
    awayScore: parts ? Number(parts[2]) : null,
    minute: status === 'live' && timer !== null && timer >= 0 && timer <= 200 ? timer : null,
    period: status === 'live' ? string(field(row.timer, 'tt')) || null : null,
    homeTeamProviderId: string(field(row.home, 'id')) || null,
    awayTeamProviderId: string(field(row.away, 'id')) || null,
    liveStats: row.stats || undefined,
  };
}

// Known basic Events API markets, deliberately not guessed from arbitrary
// bookmaker market IDs. Bet365 full-market structures need a separate adapter.
const BASIC_KEYS: Record<string, { key: string; type: string; basis?: string }> = {
  '1': { key: 'h2h', type: '1X2' },
  '2': { key: 'spreads', type: 'ASIAN_HANDICAP' },
  '3': { key: 'totals', type: 'OVER_UNDER' },
  '8': { key: 'h2h_h1', type: '1X2', basis: 'half' },
};
const sane = (value: unknown): string | null => {
  const raw = string(value).trim();
  if (!/^\d{1,4}(?:\.\d{1,4})?$/.test(raw)) return null;
  try { return isSaneOdds(oddsFromDecimalString(raw)) ? raw : null; }
  catch { return null; }
};
export const safePrice = sane;
const oddTimestamp = (value: unknown): number | null => {
  const v = integer(value);
  return v && v > 1_500_000_000 && v < 4_102_444_800 ? v : null;
};
const selections = (key: string, row: Record<string, unknown>, code: string):
  ProviderOddsSelection[] => {
  const result: ProviderOddsSelection[] = [];
  const h = string(row.handicap).trim();
  const offer = (fieldName: string, label: string, outcomeCode: string) => {
    const odds = sane(row[fieldName]);
    if (odds) result.push({
      providerId: `${key}:${outcomeCode}:${h || 'no-line'}`,
      code: outcomeCode, name: label, line: h || null, odds, status: 'open',
    });
  };
  if (key.endsWith('_1') || key === '1_8') {
    offer('home_od', 'Home', 'HOME');
    if (key === '1_1' || key === '1_8') offer('draw_od', 'Draw', 'DRAW');
    offer('away_od', 'Away', 'AWAY');
  } else if (key.endsWith('_2') || key.endsWith('_5')) {
    offer('home_od', 'Home', 'HOME');
    offer('away_od', 'Away', 'AWAY');
  } else if (key.endsWith('_3') || key.endsWith('_6')) {
    offer('over_od', 'Over', 'OVER');
    offer('under_od', 'Under', 'UNDER');
  }
  return result;
};

export function normalizeBetsapiOdds(
  matchProviderId: string,
  raw: unknown,
  observedAt: Date,
  live: boolean,
  maxAgeSeconds = live ? 45 : 300,
): ProviderOddsBundle {
  const identity = parseBetsapiIdentity(matchProviderId);
  if (!identity) return { matchProviderId, markets: [], updatedAt: observedAt.toISOString() };
  const result = object(raw);
  const odds = object(result.odds);
  const updateTimes = object(field(result.stats, 'odds_update'));
  const markets: ProviderOddsMarket[] = [];
  for (const [marketId, history] of Object.entries(odds)) {
    const [sport, market] = marketId.split('_');
    if (sport !== String(identity.sportId) || !market) continue;
    const mapped = BASIC_KEYS[market];
    // Only football full-time 1X2 is accepted into the money ledger in this
    // rollout. Other sports and markets stay visible in the Bet365 explorer,
    // but cannot be graded reliably with football-specific settlement rules.
    if (identity.sportId !== 1 || marketId !== '1_1' || !mapped || !Array.isArray(history)) continue;
    // Newest first is documented but never trust array insertion ordering.
    const rows = history.filter(x => x && typeof x === 'object')
      .map(x => object(x)).sort((a, b) => (oddTimestamp(b.add_time) || 0) - (oddTimestamp(a.add_time) || 0));
    const latest = rows[0];
    if (!latest) continue;
    const quoteTime = oddTimestamp(latest.add_time);
    const marketTime = oddTimestamp(updateTimes[marketId]);
    // Market freshness AND actual bookmaker price freshness are both required.
    const time = quoteTime && marketTime ? Math.min(quoteTime, marketTime) : null;
    if (!time || time * 1000 > observedAt.getTime() + 15_000 ||
      observedAt.getTime() - time * 1000 > maxAgeSeconds * 1000) continue;
    const items = selections(marketId, latest, mapped.key);
    if (items.length < 2) continue;
    markets.push({
      providerId: `betsapi:${marketId}`,
      key: mapped.key,
      type: mapped.type, specifier: string(latest.handicap).trim() || null,
      isLive: live, status: 'open',
      sourceUpdatedAt: new Date(time * 1000).toISOString(),
      selections: items,
    });
  }
  return { matchProviderId, markets, updatedAt: observedAt.toISOString() };
}

export function normalizeBetsapiResult(
  matchProviderId: string, raw: unknown, observedAt = new Date(), fromOfficialEnded = false,
): ProviderResultSnapshot | null {
  const event = normalizeBetsapiEvent(raw);
  if (!event || event.providerId !== matchProviderId || event.status === 'scheduled') return null;
  const row = object(raw);
  const stats = object(row.stats);
  const half = object(field(row.scores, '1'));
  const pair = (name: string) => {
    const value = stats[name];
    const arr = Array.isArray(value) ? value : [];
    return [integer(arr[0]), integer(arr[1])] as const;
  };
  const corners = pair('corners'), cards = pair('yellowcards');
  return {
    matchProviderId, status: event.status,
    homeScore: event.homeScore, awayScore: event.awayScore,
    homeHalfScore: integer(half.home), awayHalfScore: integer(half.away),
    homeCorners: corners[0], awayCorners: corners[1],
    homeCards: cards[0], awayCards: cards[1],
    extraTime: false, penalties: false, penaltyHome: null, penaltyAway: null,
    revision: 1, observedAt: observedAt.toISOString(),
    // Never automatically settle from a raw inplay or ambiguous ended status.
    authoritative: fromOfficialEnded && event.status === 'finished' &&
      event.homeScore !== null && event.awayScore !== null,
  };
}
