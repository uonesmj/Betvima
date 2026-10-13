import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/ports/db";
import { PgArray, param } from "@/server/db/rows";
import type { ProviderMatch, SportsDataProvider } from "@/lib/ports/providers";
import { PostgresCatalogRepository } from "@/server/adapters/postgres/catalog";
import {
  MATCH_SOURCE_FALLBACK,
  MATCH_SOURCE_ODDS,
  attachProviderMatchIdentity,
  fetchOddsForOwningProvider,
  fiveDollarProviderEventId,
  linkCrossProviderMatch,
  resolveFiveDollarMatchRows,
  resolveSportsOddsProvider,
  type CrossProviderMatchCandidate,
} from "@/workers/sports-provider-sync";

const matchId = "match-canonical-1";
const kickOff = "2026-10-12T18:00:00.000Z";

function incomingMatch(overrides: Partial<ProviderMatch> = {}): ProviderMatch {
  return {
    providerId: "5d-fixture-1",
    sport: "football",
    leagueProviderId: "league-1",
    leagueName: "Premier League",
    countryCode: "GB",
    homeTeamName: "Northbridge FC",
    awayTeamName: "Southbridge United",
    scheduledAt: kickOff,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    minute: null,
    period: null,
    ...overrides,
  };
}

function candidate(overrides: Partial<CrossProviderMatchCandidate> = {}): CrossProviderMatchCandidate {
  return {
    id: matchId,
    provider_id: "odds-event-1",
    scheduled_at: kickOff,
    sport: "football",
    league_name: "Premier League",
    country_code: "GB",
    home_team: "Northbridge",
    away_team: "Southbridge United",
    ...overrides,
  };
}

function fakeDb(candidates: CrossProviderMatchCandidate[] = []) {
  const aliases = new Map<string, string>();
  const query = vi.fn(async <T,>(_sql: string, _params?: unknown[]) => candidates as T[]);
  const queryOne = vi.fn(async <T,>(_sql: string, params?: unknown[]) => {
    const [provider, providerId, internalId] = params as string[];
    const key = `${provider}:match:${providerId}`;
    const current = aliases.get(key);
    if (current && current !== internalId) return null;
    aliases.set(key, internalId!);
    return { internal_id: internalId } as T;
  });
  return { db: { query, queryOne } as unknown as Db, aliases, query, queryOne };
}

describe("Odds API and FiveDollar source synchronization", () => {
  it("links both source IDs to one canonical match and remains idempotent", async () => {
    const fake = fakeDb([candidate()]);
    const oddsLinked = await attachProviderMatchIdentity(
      fake.db,
      MATCH_SOURCE_ODDS,
      "odds-event-1",
      matchId,
    );
    const first = await linkCrossProviderMatch(
      fake.db,
      incomingMatch(),
      MATCH_SOURCE_FALLBACK,
      MATCH_SOURCE_ODDS,
    );
    const repeated = await linkCrossProviderMatch(
      fake.db,
      incomingMatch(),
      MATCH_SOURCE_FALLBACK,
      MATCH_SOURCE_ODDS,
    );

    expect(oddsLinked).toBe(true);
    expect(first).toEqual({ status: "linked", matchId });
    expect(repeated).toEqual({ status: "linked", matchId });
    expect(fake.aliases.size).toBe(2);
    expect(fake.aliases.get(`${MATCH_SOURCE_ODDS}:match:odds-event-1`)).toBe(matchId);
    expect(fake.aliases.get(`${MATCH_SOURCE_FALLBACK}:match:5d-fixture-1`)).toBe(matchId);
  });

  it.each([
    ["kickoff differs by more than ten minutes", { scheduled_at: "2026-10-12T18:10:01.000Z" }],
    ["teams do not match", { home_team: "Other Town" }],
    ["league does not match", { league_name: "National Cup" }],
    ["sport does not match", { sport: "basketball" }],
  ])("does not merge when %s", async (_reason, overrides) => {
    const fake = fakeDb([candidate(overrides)]);
    const result = await linkCrossProviderMatch(
      fake.db,
      incomingMatch(),
      MATCH_SOURCE_FALLBACK,
      MATCH_SOURCE_ODDS,
    );

    expect(result).toEqual({ status: "not_found" });
    expect(fake.aliases.size).toBe(0);
  });

  it("leaves ambiguous same-identity candidates separate", async () => {
    const fake = fakeDb([
      candidate(),
      candidate({ id: "match-canonical-2", provider_id: "odds-event-2" }),
    ]);
    const result = await linkCrossProviderMatch(
      fake.db,
      incomingMatch(),
      MATCH_SOURCE_FALLBACK,
      MATCH_SOURCE_ODDS,
    );

    expect(result).toEqual({ status: "not_found" });
    expect(fake.aliases.size).toBe(0);
  });

  it("never requests odds from FiveDollar, including legacy owned fixtures", async () => {
    const oddsFetch = vi.fn(async (ids: string[]) => ({
      ok: true,
      value: [{ matchProviderId: ids[0]!, markets: [], updatedAt: kickOff }],
    }));
    const fiveDollarFetch = vi.fn(async (ids: string[]) => ({
      ok: true,
      value: [{ matchProviderId: ids[0]!, markets: [], updatedAt: kickOff }],
    }));
    const odds = { name: MATCH_SOURCE_ODDS, fetchOdds: oddsFetch } as unknown as SportsDataProvider;
    const fiveDollar = { name: MATCH_SOURCE_FALLBACK, fetchOdds: fiveDollarFetch } as unknown as SportsDataProvider;
    const providers = [odds, fiveDollar];

    const priced = resolveSportsOddsProvider(MATCH_SOURCE_ODDS, providers, odds);
    expect(priced).toBe(odds);
    const response = await fetchOddsForOwningProvider(priced!, 'odds-event-1');
    expect(response.ok).toBe(true);
    expect(oddsFetch).toHaveBeenCalledWith(['odds-event-1']);

    expect(resolveSportsOddsProvider(MATCH_SOURCE_FALLBACK, providers, odds)).toBeNull();
    const refused = await fetchOddsForOwningProvider(fiveDollar, '5d-fixture-1');
    expect(refused).toMatchObject({ ok: false, errorCode: 'ODDS_PROVIDER_NOT_AUTHORIZED' });
    expect(fiveDollarFetch).not.toHaveBeenCalled();
  });

  it("resolves FiveDollar live fixtures through their canonical alias and exposes FiveDollar events", async () => {
    const aliasDb = {
      query: vi.fn(async <T,>(sql: string, params?: unknown[]) => {
        expect(sql).toContain("coalesce(direct_match.id, pe.internal_id)");
        expect(params?.[0]).toBe(MATCH_SOURCE_FALLBACK);
        expect(params?.[1]).toBeInstanceOf(PgArray);
        expect(param(params?.[1])).toEqual(["5d-fixture-1"]);
        return [{
          match_id: matchId,
          provider_id: "5d-fixture-1",
          match_provider: MATCH_SOURCE_ODDS,
          home_team_id: "team-home",
          away_team_id: "team-away",
        }] as T[];
      }),
    } as unknown as Db;
    const [resolved] = await resolveFiveDollarMatchRows(aliasDb, ["5d-fixture-1"]);
    expect(resolved?.match_id).toBe(matchId);
    expect(resolved?.match_provider).toBe(MATCH_SOURCE_ODDS);

    const providerEventId = fiveDollarProviderEventId("5d-fixture-1", "goal-71");
    expect(providerEventId).toBe("5dollar:5d-fixture-1:goal-71");

    let capturedSql = "";
    const eventDb = {
      query: vi.fn(async <T,>(sql: string) => {
        capturedSql = sql;
        return [{
          id: "event-1",
          provider_event_id: providerEventId,
          type: "goal",
          minute: 71,
          period: "second_half",
          team_id: "team-home",
          player_name: "Player One",
          detail: null,
          occurred_at: kickOff,
          team_name: "Northbridge",
        }] as T[];
      }),
    } as unknown as Db;
    const events = await new PostgresCatalogRepository(eventDb).listMatchEvents(matchId);

    expect(capturedSql).toContain("e.provider_event_id like '5dollar:%'");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      providerEventId,
      type: "goal",
      minute: 71,
      teamName: "Northbridge",
    });
  });
});
