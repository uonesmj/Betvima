/**
 * Server-side read helpers for pages. Pages never call their own HTTP API: they read
 * through the same repositories the API uses, so responses are consistent and there is
 * one place where serialization (bigint -> string) happens.
 */
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { logger } from '@/server/logger';
import { isLiveBettingEnabled, readLiveBettingEnabled } from '@/server/live-betting';
import type { Match, Market } from '@/lib/types';

/**
 * A read that is allowed to fail without taking the whole page down.
 *
 * Pages must never turn a database failure into "there is nothing here": an empty catalogue and a
 * broken catalogue look identical to a visitor and to an operator. Every degraded read is logged
 * and reported to the page, which renders an explicit notice next to the (empty) section.
 */
interface Settled<T> { value: T; failed: boolean }

async function settle<T>(section: string, promise: Promise<T>, fallback: T): Promise<Settled<T>> {
  try {
    return { value: await promise, failed: false };
  } catch (error) {
    logger.error('public.read_failed', { section, message: error instanceof Error ? error.message : String(error) });
    return { value: fallback, failed: true };
  }
}

const failedSections = (...entries: [string, Settled<unknown>][]): string[] =>
  entries.filter(([, entry]) => entry.failed).map(([name]) => name);

export interface MatchViewPayload {
  id: string; sportKey: string; leagueId: string | null; leagueName: string | null; leagueLogoUrl: string | null; countryCode: string | null;
  status: string; scheduledAt: string; minute: number | null; period: string | null; homeScore: number | null; awayScore: number | null;
  participants: { teamId: string; role: string; name: string; logoUrl: string | null }[];
  isLive: boolean; isBettingAvailable: boolean; marketsCount?: number;
  topMarkets: { id: string; key: string; name: string; status: string; selections: SelectionPayload[] }[];
}
export interface SelectionPayload {
  id: string; code: string; name: string; oddsScaled: string;
  previousOddsScaled: string | null; status: string; movement?: 'UP' | 'DOWN' | 'STABLE'; oddsVersion: number;
}

export const serializeMatch = (match: Match): MatchViewPayload => ({
  id: match.id, sportKey: match.sportKey, leagueId: match.leagueId, leagueName: match.leagueName, leagueLogoUrl: match.leagueLogoUrl, countryCode: match.countryCode,
  status: match.status, scheduledAt: match.scheduledAt, minute: match.minute, period: match.period,
  homeScore: match.homeScore, awayScore: match.awayScore,
  participants: match.participants.map((p) => ({ teamId: p.teamId, role: p.role, name: p.name, logoUrl: p.logoUrl })),
  isLive: match.isLive, isBettingAvailable: match.isBettingAvailable, marketsCount: match.marketsCount,
  topMarkets: (match.topMarkets ?? []).map((m) => ({
    id: m.id, key: m.key, name: m.nameFa || m.nameEn, status: m.status,
    selections: m.selections.map(serializeSelection),
  })),
});

export const serializeSelection = (s: { id: string; code: string; nameFa: string; nameEn: string; oddsScaled: bigint; previousOddsScaled: bigint | null; status: string; movement?: 'UP' | 'DOWN' | 'STABLE'; oddsVersion: number }): SelectionPayload => ({
  id: s.id, code: s.code, name: s.nameEn || s.nameFa, oddsScaled: s.oddsScaled.toString(),
  previousOddsScaled: s.previousOddsScaled === null ? null : s.previousOddsScaled.toString(),
  status: s.status, movement: s.movement, oddsVersion: s.oddsVersion,
});

export const serializeMarket = (market: Market) => ({
  id: market.id,
  key: market.key,
  name: market.nameFa || market.nameEn,
  status: market.status,
  specifier: market.specifier,
  selections: market.selections.map(serializeSelection),
});

export async function getHomepageData() {
  const services = createServices();
  const [live, upcoming, topBets, sports] = await Promise.all([
    settle('live', services.catalog.listLiveMatches(serviceRoleContext, 6), [] as Awaited<ReturnType<typeof services.catalog.listLiveMatches>>),
    settle('upcoming', services.catalog.listUpcomingMatches(serviceRoleContext, 72, 12), [] as Awaited<ReturnType<typeof services.catalog.listUpcomingMatches>>),
    settle('topBets', services.catalog.listTopBetMatches(serviceRoleContext, 168, 6), [] as Awaited<ReturnType<typeof services.catalog.listTopBetMatches>>),
    settle('sports', services.catalog.listSports(serviceRoleContext), [] as Awaited<ReturnType<typeof services.catalog.listSports>>),
  ]);
  return {
    live: live.value.map(serializeMatch),
    upcoming: upcoming.value.map(serializeMatch),
    topBets: topBets.value.map(serializeMatch),
    sports: sports.value.map((s) => ({ key: s.key, name: s.nameEn || s.nameFa, icon: s.icon })),
    degraded: failedSections(['live', live], ['upcoming', upcoming], ['topBets', topBets], ['sports', sports]),
  };
}

type MatchHistoryItem = {
  providerId: string;
  scheduledAt: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  result: 'W' | 'D' | 'L' | null;
};

type MatchHistoryPayload = {
  home: MatchHistoryItem[];
  away: MatchHistoryItem[];
  h2h: MatchHistoryItem[];
};

const matchHistoryCache = new Map<string, { expiresAt: number; value: MatchHistoryPayload }>();
const MATCH_HISTORY_TTL_MS = 5 * 60 * 1000;

function historyItem(
  fixture: import('@/lib/ports/providers').ProviderMatch,
  teamProviderId: string,
): MatchHistoryItem | null {
  const homeTeamId = fixture.homeTeamProviderId;
  const awayTeamId = fixture.awayTeamProviderId;
  const homeScore = fixture.homeScore;
  const awayScore = fixture.awayScore;

  const isHome = homeTeamId != null && String(homeTeamId) === String(teamProviderId);
  const isAway = awayTeamId != null && String(awayTeamId) === String(teamProviderId);

  if ((!isHome && !isAway) || homeScore == null || awayScore == null) return null;

  const result =
    homeScore === awayScore
      ? 'D'
      : (isHome ? homeScore > awayScore : awayScore > homeScore)
        ? 'W'
        : 'L';

  return {
    providerId: String(fixture.providerId),
    scheduledAt: String(fixture.scheduledAt),
    homeTeam: fixture.homeTeamName,
    awayTeam: fixture.awayTeamName,
    homeScore,
    awayScore,
    result,
  };
}

async function loadMatchHistory(
  services: ReturnType<typeof createServices>,
  match: Match,
): Promise<MatchHistoryPayload> {
  const cacheKey = `${match.provider}:${match.id}`;
  const cached = matchHistoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const empty: MatchHistoryPayload = { home: [], away: [], h2h: [] };
  const sports = services.providers.sports;

  if (
    sports.name !== '5dollarfootballapi' ||
    !sports.fetchFixture ||
    !sports.fetchTeamFixtures
  ) {
    return empty;
  }

  const providerMatch = await services.db.queryOne<{ provider_id: string }>(
    `select provider_id from nova.matches where id = $1 limit 1`,
    [match.id],
  );

  const providerId = providerMatch?.provider_id;
  if (!providerId) return empty;

  console.log("[MATCH_HISTORY] start", {
    matchId: match.id,
    provider: match.provider,
    providerId,
  });

  const fixtureResult = await sports.fetchFixture(providerId);
  console.log("[MATCH_HISTORY] fixture", {
    ok: fixtureResult.ok,
    hasValue: Boolean(fixtureResult.value),
    errorCode: fixtureResult.errorCode,
    errorMessage: fixtureResult.errorMessage,
  });
  if (!fixtureResult.ok || !fixtureResult.value) return empty;

  const fixture = fixtureResult.value;
  const homeTeamProviderId = fixture.homeTeamProviderId;
  const awayTeamProviderId = fixture.awayTeamProviderId;

  console.log("[MATCH_HISTORY] teams", {
    homeTeamProviderId,
    awayTeamProviderId,
  });

  if (!homeTeamProviderId || !awayTeamProviderId) return empty;

  const [homeHistoryResult, awayHistoryResult] = await Promise.all([
    sports.fetchTeamFixtures(homeTeamProviderId, { page: 1, perPage: 100 }),
    sports.fetchTeamFixtures(awayTeamProviderId, { page: 1, perPage: 100 }),
  ]);

  const homeFixtures = homeHistoryResult.ok && homeHistoryResult.value
    ? homeHistoryResult.value
    : [];
  const awayFixtures = awayHistoryResult.ok && awayHistoryResult.value
    ? awayHistoryResult.value
    : [];

  console.log("[MATCH_HISTORY] histories", {
    homeOk: homeHistoryResult.ok,
    homeCount: homeFixtures.length,
    homeError: homeHistoryResult.errorMessage,
    awayOk: awayHistoryResult.ok,
    awayCount: awayFixtures.length,
    awayError: awayHistoryResult.errorMessage,
  });

  const finished = (fixture: import('@/lib/ports/providers').ProviderMatch) =>
    String(fixture.status).toLowerCase() === 'finished';

  const homeRecent = homeFixtures
    .filter(finished)
    .map((f) => historyItem(f, homeTeamProviderId))
    .filter((x): x is MatchHistoryItem => x !== null)
    .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt))
    .slice(0, 5);

  const awayRecent = awayFixtures
    .filter(finished)
    .map((f) => historyItem(f, awayTeamProviderId))
    .filter((x): x is MatchHistoryItem => x !== null)
    .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt))
    .slice(0, 5);

  const awayByProviderId = new Map(
    awayFixtures
      .filter(finished)
      .map((f) => [String(f.providerId), f] as const),
  );

  const h2h = homeFixtures
    .filter(finished)
    .filter((f) => awayByProviderId.has(String(f.providerId)))
    .map((f) => historyItem(f, homeTeamProviderId))
    .filter((x): x is MatchHistoryItem => x !== null)
    .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt))
    .slice(0, 5);

  const value: MatchHistoryPayload = {
    home: homeRecent,
    away: awayRecent,
    h2h,
  };

  console.log("[MATCH_HISTORY] result", {
    home: homeRecent.length,
    away: awayRecent.length,
    h2h: h2h.length,
  });

  matchHistoryCache.set(cacheKey, {
    expiresAt: Date.now() + MATCH_HISTORY_TTL_MS,
    value,
  });

  return value;
}

export async function getMatchPageData(id: string) {
  const services = createServices();
  const match = await services.catalog.getMatchBySlugOrId(serviceRoleContext, id);
  if (!match) return null;
  // No catch here on purpose: markets are the content of the page, so a failing read surfaces as an
  // error page with a retry instead of an empty "no markets" screen during an incident.
  const [markets, result, liveBettingEnabled, liveEvents, liveStats, matchHistory] = await Promise.all([
    services.catalog.listMarkets(serviceRoleContext, match.id, { includeSuspended: true }),
    services.catalog.getResult(match.id),
    readLiveBettingEnabled(services.admin),
    match.isLive
      ? services.catalog.listMatchEvents(match.id)
      : Promise.resolve([]),
    match.isLive
      ? services.catalog.getMatchStats(match.id)
      : Promise.resolve(null),
    loadMatchHistory(services, match),
  ]);
  return {
    match: serializeMatch(match),
    markets: markets.map(serializeMarket),
    result,
    liveEvents,
    liveStats,
    liveBettingEnabled,
    matchHistory,
  };
}

export async function getServiceAvailability() {
  const services = createServices();
  const [statuses, operations] = await Promise.all([
    settle('provider_statuses', services.providers.statuses(), [] as Awaited<ReturnType<typeof services.providers.statuses>>),
    settle('operations', services.admin.operations(), [] as Awaited<ReturnType<typeof services.admin.operations>>),
  ]);
  return {
    sportsConfigured: services.providers.sports.configured,
    paymentsConfigured: services.providers.payments.configured,
    statuses: statuses.value,
    operations: operations.value,
    liveBettingEnabled: isLiveBettingEnabled(operations.value),
    degraded: failedSections(['provider_statuses', statuses], ['operations', operations]),
  };
}
