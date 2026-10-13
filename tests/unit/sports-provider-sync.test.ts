import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/ports/db";
import type { SportsDataProvider } from "@/lib/ports/providers";
import {
  MATCH_SOURCE_ODDS, attachProviderMatchIdentity,
  fetchOddsForOwningProvider, resolveSportsOddsProvider,
} from "@/workers/sports-provider-sync";

describe("single-source Odds API sports ownership", () => {
  it("keeps canonical Odds API match identity idempotent", async () => {
    const queryOne = vi.fn(async () => ({ internal_id: "match-a" }));
    const db = { queryOne } as unknown as Db;
    const linked = await attachProviderMatchIdentity(db, MATCH_SOURCE_ODDS, "event-a", "match-a");
    expect(linked).toBe(true);
    expect(queryOne).toHaveBeenCalledTimes(1);
    expect(await attachProviderMatchIdentity(db, "legacy-football-feed", "legacy-a", "match-a")).toBe(false);
    expect(queryOne).toHaveBeenCalledTimes(1);
  });

  it("never selects or queries any external alternative sports or betting source", async () => {
    const oddsFetch = vi.fn().mockResolvedValue({
      ok: true, value: [{ matchProviderId: "event-a", markets: [], updatedAt: "2026-10-13T18:00:00Z" }],
    });
    const otherFetch = vi.fn();
    const odds = { name: MATCH_SOURCE_ODDS, fetchOdds: oddsFetch } as unknown as SportsDataProvider;
    const other = { name: "legacy-football-feed", fetchOdds: otherFetch } as unknown as SportsDataProvider;

    expect(resolveSportsOddsProvider(MATCH_SOURCE_ODDS, [other, odds], odds)).toBe(odds);
    expect(resolveSportsOddsProvider("legacy-football-feed", [other, odds], odds)).toBeNull();
    const successful = await fetchOddsForOwningProvider(odds, "event-a");
    expect(successful.ok).toBe(true);
    expect(oddsFetch).toHaveBeenCalledWith(["event-a"]);
    const refused = await fetchOddsForOwningProvider(other, "legacy-a");
    expect(refused).toMatchObject({ ok: false, errorCode: "ODDS_PROVIDER_NOT_AUTHORIZED" });
    expect(otherFetch).not.toHaveBeenCalled();
  });
});
