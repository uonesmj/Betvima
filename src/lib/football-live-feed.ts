import { z } from 'zod';

/**
 * Provider-independent, read-only football match centre contract.
 *
 * A licensed feed can supply any number of fixtures, markets, statistics and
 * incidents. This module NEVER grants permission to quote a bet or settle
 * wagers; the regulated trading and finance pipeline stays separate.
 */
const utcTime = z.string().datetime({ offset: true });
const team = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(180),
}).strict();
const score = z.object({
  home: z.number().int().min(0).max(99),
  away: z.number().int().min(0).max(99),
}).strict();
const selection = z.object({
  id: z.string().min(1).max(160),
  label: z.string().min(1).max(180),
  decimalOdds: z.number().finite().min(1.01).max(1000).nullable(),
  status: z.enum(['open', 'suspended', 'closed']),
}).strict();
const market = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(180),
  category: z.string().min(1).max(120),
  line: z.string().max(40).nullable(),
  status: z.enum(['open', 'suspended', 'closed']),
  lastPriceChangeUtc: utcTime.nullable(),
  selections: z.array(selection).max(200),
}).strict();
const incident = z.object({
  id: z.string().min(1).max(140),
  minute: z.number().int().min(0).max(140),
  addedMinute: z.number().int().min(0).max(40).nullable(),
  side: z.enum(['home', 'away', 'neutral']),
  type: z.enum(['goal', 'own_goal', 'penalty', 'yellow_card', 'red_card', 'substitution', 'var', 'corner', 'kickoff', 'halftime', 'fulltime', 'other']),
  description: z.string().min(1).max(240),
}).strict();
const statistics = z.object({
  possession: score.nullable(),
  shots: score.nullable(),
  shotsOnTarget: score.nullable(),
  corners: score.nullable(),
  yellowCards: score.nullable(),
  redCards: score.nullable(),
  fouls: score.nullable(),
}).strict();
const fixture = z.object({
  id: z.string().min(1).max(150),
  leagueId: z.string().min(1).max(100),
  leagueName: z.string().min(1).max(180),
  country: z.string().min(1).max(120),
  home: team,
  away: team,
  kickoffUtc: utcTime,
  state: z.enum(['live', 'halftime', 'suspended', 'finished']),
  minute: z.number().int().min(0).max(140),
  addedMinute: z.number().int().min(0).max(40).nullable(),
  score,
  statistics,
  incidents: z.array(incident).max(500),
  markets: z.array(market).max(2000),
}).strict();
const feed = z.object({
  source: z.object({
    providerId: z.string().min(1),
    commercialUsePermitted: z.boolean(),
    licenceReference: z.string().max(240).nullable(),
  }).strict(),
  receivedAtUtc: utcTime,
  fixtures: z.array(fixture).max(2500),
}).strict();

export type FootballFixture = z.infer<typeof fixture>;
export type FootballMarket = z.infer<typeof market>;
export type FootballSnapshot = z.infer<typeof feed>;
export type FootballIncident = z.infer<typeof incident>;

export type FootballFeedResult =
  | { ok: true; fixtures: FootballFixture[]; receivedAtUtc: string; readOnly: true; }
  | { ok: false; reason: 'invalid_payload' | 'commercial_rights_unverified' | 'feed_stale' | 'duplicate_identity'; fixtures: []; readOnly: true; };

/** Default timeout for a live feed heartbeat. An unchanged price is not a stale feed. */
export const MAX_LIVE_FEED_HEARTBEAT_AGE_MS = 20_000;

/**
 * Validates the entire *snapshot* atomically. Missing markets must not survive
 * from a prior payload and identity collisions cannot be silently overwritten.
 * A source without explicit verified commercial usage rights fails closed.
 */
export function parseLicensedFootballFeed(
  input: unknown,
  nowMs: number = Date.now(),
): FootballFeedResult {
  const result = feed.safeParse(input);
  if (!result.success) {
    return { ok: false, reason: 'invalid_payload', fixtures: [], readOnly: true };
  }
  const parsed = result.data;
  if (parsed.source.commercialUsePermitted !== true || !parsed.source.licenceReference?.trim()) {
    return { ok: false, reason: 'commercial_rights_unverified', fixtures: [], readOnly: true };
  }
  const timestamp = Date.parse(parsed.receivedAtUtc);
  if (!Number.isFinite(timestamp) || timestamp > nowMs + 5_000 ||
      nowMs - timestamp > MAX_LIVE_FEED_HEARTBEAT_AGE_MS) {
    return { ok: false, reason: 'feed_stale', fixtures: [], readOnly: true };
  }
  const ids = new Set<string>();
  for (const item of parsed.fixtures) {
    if (ids.has(item.id)) {
      return { ok: false, reason: 'duplicate_identity', fixtures: [], readOnly: true };
    }
    ids.add(item.id);
    const marketIds = new Set<string>();
    const incidentIds = new Set<string>();
    for (const entry of item.incidents) {
      if (incidentIds.has(entry.id)) {
        return { ok: false, reason: 'duplicate_identity', fixtures: [], readOnly: true };
      }
      incidentIds.add(entry.id);
    }
    for (const entry of item.markets) {
      if (marketIds.has(entry.id)) {
        return { ok: false, reason: 'duplicate_identity', fixtures: [], readOnly: true };
      }
      marketIds.add(entry.id);
      const selectionIds = new Set<string>();
      for (const choice of entry.selections) {
        if (selectionIds.has(choice.id)) {
          return { ok: false, reason: 'duplicate_identity', fixtures: [], readOnly: true };
        }
        selectionIds.add(choice.id);
      }
    }
  }
  return { ok: true, fixtures: parsed.fixtures, receivedAtUtc: parsed.receivedAtUtc, readOnly: true };
}

export function renderableOdds(
  fixtureState: FootballFixture['state'],
  marketState: FootballMarket['status'],
  selection: FootballMarket['selections'][number],
): string {
  if (fixtureState === 'suspended' || fixtureState === 'finished' ||
      marketState !== 'open' || selection.status !== 'open' ||
      selection.decimalOdds === null) {
    return '—';
  }
  return selection.decimalOdds.toFixed(2);
}

export function footballLeagues(fixtures: readonly FootballFixture[]) {
  const leagues = new Map<string, { id: string; name: string; country: string; count: number }>();
  for (const fixtureItem of fixtures) {
    const key = fixtureItem.leagueId;
    const current = leagues.get(key);
    if (current) current.count += 1;
    else leagues.set(key, { id: key, name: fixtureItem.leagueName,
      country: fixtureItem.country, count: 1 });
  }
  return [...leagues.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Never enable bets on read-only research fixtures. */
export const FOOTBALL_PREVIEW_BETTING_ENABLED = false as const;
