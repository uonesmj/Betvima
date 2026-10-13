import type { ISODateString } from "@/lib/types";
import { authenticatedFiveDollarH2h } from "./fivedollar-authenticated-h2h";
import type {
  ProviderMatch,
  ProviderOddsBundle,
  ProviderResult,
  ProviderResultSnapshot,
  ProviderStatus,
  SportsDataProvider,
} from "@/lib/ports/providers";

const BASE_URL = (process.env.FIVEDOLLAR_API_BASE_URL || (process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? process.env.SPORTS_PROVIDER_BASE_URL : "") || "https://api.5dollarfootballapi.com/v1").replace(/\/+$/, "");
const API_KEY = (process.env.FIVEDOLLAR_API_KEY || (process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? process.env.SPORTS_PROVIDER_API_KEY : "")) || "";

type Json = Record<string, any>;

const ok = <T>(value: T): ProviderResult<T> => ({ ok: true, value });
const fail = <T>(message: string, code = "PROVIDER_ERROR"): ProviderResult<T> => ({
  ok: false,
  value: null,
  errorCode: code,
  errorMessage: message,
  retryable: true,
});

function iso(value: unknown): ISODateString {
  const d = new Date(String(value));
  return (Number.isFinite(d.getTime()) ? d : new Date()).toISOString();
}

function numberOrNull(value: unknown): number | null {
  // Missing score or match statistics must never be manufactured as zero.
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function score(obj: any, side: "home" | "away"): number | null {
  return numberOrNull(obj?.goals?.[side]);
}

function isLiveStatus(status: unknown): boolean {
  return ["live", "in_play", "1h", "2h", "ht", "extra_time", "penalties"].includes(String(status).toLowerCase());
}

function statusOf(fixture: any): string {
  const raw = String(fixture?.status || "").toLowerCase();
  if (isLiveStatus(raw)) return "live";
  if (raw === "finished" || raw === "ft" || raw === "aet" || raw === "pen") return "finished";
  if (raw === "scheduled" || raw === "not_started") return "scheduled";
  if (raw === "cancelled" || raw === "canceled") return "cancelled";
  if (raw === "postponed") return "postponed";
  if (raw === "paused" || raw === "break" || raw === "halftime") return "paused";
  return "scheduled";
}

function minuteOf(fixture: any): number | null {
  const direct =
    numberOrNull(fixture?.minute) ??
    numberOrNull(fixture?.elapsed) ??
    numberOrNull(fixture?.status?.elapsed);

  if (direct != null) return direct;

  const events = Array.isArray(fixture?.events) ? fixture.events : [];
  const minutes = events
    .map((event: any) => numberOrNull(event?.minute))
    .filter((minute: number | null): minute is number => minute != null);

  return minutes.length > 0 ? Math.max(...minutes) : null;
}

function periodOf(fixture: any): string | null {
  const direct = fixture?.period;
  if (direct != null && String(direct).trim() !== "") return String(direct);

  const events = Array.isArray(fixture?.events) ? fixture.events : [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const period = events[index]?.period;
    if (period != null && String(period).trim() !== "") {
      return String(period);
    }
  }

  const fallback = fixture?.status_reason ?? fixture?.status?.short;
  return fallback == null ? null : String(fallback);
}

const REQUEST_INTERVAL_MS = 4000;
let requestQueue: Promise<void> = Promise.resolve();

async function request<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  if (!API_KEY) {
    throw new Error("SPORTS_PROVIDER_API_KEY is not configured");
  }

  let release!: () => void;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });

  const previous = requestQueue;
  requestQueue = previous.then(() => turn, () => turn);

  await previous.catch(() => undefined);

  try {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS));

    const url = new URL(
      `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
    );

    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const body = await response.text();

    let json: any = null;
    try {
      json = body ? JSON.parse(body) : null;
    } catch {
      throw new Error(
        `5DollarFootballAPI returned invalid JSON (${response.status})`,
      );
    }

    if (!response.ok || json?.success !== 1) {
      const message =
        json?.error?.message ||
        json?.message ||
        `5DollarFootballAPI HTTP ${response.status}`;

      throw new Error(message);
    }

    return json as T;
  } finally {
    release();
  }
}

function mapFixture(fixture: any, sport: "football" | "esports" = "football"): ProviderMatch {
  const live = isLiveStatus(fixture?.status);
  return {
    providerId: String(fixture.id),
    sport,
    leagueProviderId:
      fixture?.league?.id == null ? null : String(fixture.league.id),
    leagueName: fixture?.league?.name ?? null,
    countryCode: fixture?.league?.country?.code ?? fixture?.country?.code ?? null,
    homeTeamName: String(fixture?.teams?.home?.name ?? ""),
    awayTeamName: String(fixture?.teams?.away?.name ?? ""),
    homeTeamProviderId:
      fixture?.teams?.home?.id == null ? null : String(fixture.teams.home.id),
    awayTeamProviderId:
      fixture?.teams?.away?.id == null ? null : String(fixture.teams.away.id),
    scheduledAt: iso(fixture?.kickoff_utc),
    status: live ? "live" : statusOf(fixture),
    homeScore: score(fixture, "home"),
    awayScore: score(fixture, "away"),
    minute: live ? minuteOf(fixture) : null,
    period: live ? periodOf(fixture) : null,
    homeHalfScore: numberOrNull(fixture?.goals?.half_time?.home ?? fixture?.half_score?.home),
    awayHalfScore: numberOrNull(fixture?.goals?.half_time?.away ?? fixture?.half_score?.away),
    liveEvents: Array.isArray(fixture?.events) ? fixture.events : [],
    liveStats: {
      ...(fixture?.statistics && typeof fixture.statistics === "object" ? fixture.statistics : {}),
      corners: fixture?.corners ?? null,
      cards: fixture?.cards ?? null,
    },
  };
}

// Price ingestion is separately gated; fixture, event and result access remains independent.

export class FiveDollarFootballApiSportsProvider implements SportsDataProvider {
  readonly name = "5dollarfootballapi";
  readonly configured = Boolean(API_KEY);

  async health(): Promise<ProviderStatus> {
    const requiredEnv = ["SPORTS_PROVIDER_BASE_URL", "SPORTS_PROVIDER_API_KEY"];
    if (!API_KEY) {
      return {
        provider: this.name,
        category: "sports",
        configured: false,
        enabled: true,
        reachable: false,
        lastError: "SPORTS_PROVIDER_API_KEY is not configured",
        lastSuccessAt: null,
        requiredEnv,
        notes: "5DollarFootballAPI is not configured.",
      };
    }

    try {
      await request<any>("/status");
      return {
        provider: this.name,
        category: "sports",
        configured: true,
        enabled: true,
        reachable: true,
        lastError: null,
        lastSuccessAt: new Date().toISOString() as ISODateString,
        requiredEnv,
        notes: "5DollarFootballAPI is reachable.",
      };
    } catch (error) {
      return {
        provider: this.name,
        category: "sports",
        configured: true,
        enabled: true,
        reachable: false,
        lastError: error instanceof Error ? error.message : String(error),
        lastSuccessAt: null,
        requiredEnv,
        notes: "5DollarFootballAPI is configured but unreachable.",
      };
    }
  }

  async fetchMatches(window: {
    from: ISODateString;
    to: ISODateString;
    sport?: string;
  }): Promise<ProviderResult<ProviderMatch[]>> {
    if (
      window.sport &&
      window.sport !== "football" &&
      window.sport !== "soccer"
    ) {
      return ok([]);
    }

    try {
      const from = new Date(window.from).getTime();
      const to = new Date(window.to).getTime();
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
        return fail("Invalid match window", "INVALID_WINDOW");
      }

      const result: ProviderMatch[] = [];
      const seen = new Set<string>();

      const fetchFootballFixtures = async () => {
        let cursor = from;

        while (cursor < to) {
          const end = Math.min(cursor + 24 * 60 * 60 * 1000, to);
          let page = 1;

          while (page <= 10) {
            const payload = await request<any>("/fixtures", {
              status: "all",
              start_time: Math.floor(cursor / 1000),
              end_time: Math.floor(end / 1000),
              page,
              per_page: 100,
            });

            for (const fixture of payload?.data || []) {
              const mapped = mapFixture(fixture, "football");
              const key = `football:${mapped.providerId}`;
              if (!seen.has(key)) {
                seen.add(key);
                result.push(mapped);
              }
            }

            if (!payload?.pagination?.has_more) break;

            const nextPage = Number(payload?.pagination?.page ?? page) + 1;
            if (!Number.isFinite(nextPage) || nextPage <= page) break;
            page = nextPage;
          }

          cursor = end;
        }
      };

      // Past/current/future football fixtures; no esports or bookmaker feed.
      await fetchFootballFixtures();

      return ok(result);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  async fetchLiveMatches(sport?: string): Promise<ProviderResult<ProviderMatch[]>> {
    if (
      sport &&
      sport !== "football" &&
      sport !== "soccer"
    ) {
      return ok([]);
    }

    try {
      const result: ProviderMatch[] = [];
      const seen = new Set<string>();

      const fetchLiveFootball = async () => {
        const payload = await request<any>("/fixtures", {
          status: "live",
          per_page: 500,
          include: "events,stats",
        });

        for (const fixture of payload?.data || []) {
          const mapped = {
            ...mapFixture(fixture, "football"),
            status: "live" as const,
          };
          const key = `football:${mapped.providerId}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push(mapped);
          }
        }
      };

      await fetchLiveFootball();

      return ok(result);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  async fetchOdds(matchProviderIds: string[]): Promise<ProviderResult<ProviderOddsBundle[]>> {
    // No change to betting ownership until the settlement and SQL quote guards
    // have been audited against the second source. CI may test mapping while
    // production stays off by default.
    if (process.env.FIVEDOLLAR_BETTING_ODDS_ENABLED !== "true") {
      return {
        ok: false, value: null, errorCode: "ODDS_NOT_SUPPORTED",
        errorMessage: "FiveDollar betting odds require a separately verified rollout",
        retryable: false,
      };
    }
    const ids = [...new Set(matchProviderIds.map(id => String(id).trim()).filter(id => /^\d{1,20}$/.test(id)))].slice(0, 1);
    const bundles: ProviderOddsBundle[] = [];
    let failures = 0;
    for (const fixtureId of ids) {
      try {
        // A snapshot's retrieval time is NOT a bookmaker price timestamp.
        // Require Ultra's timestamped tick history and exact quote equality.
        const [fixtureResponse, historyResponse] = await Promise.all([
          request<any>(`/fixtures/${encodeURIComponent(fixtureId)}`, { include: "odds" }),
          request<any>(`/fixtures/${encodeURIComponent(fixtureId)}/odds/history`, {
            bookmaker: "bet365", market: "1x2", per_page: 500,
          }),
        ]);
        const bundle = authenticatedFiveDollarH2h(fixtureResponse?.data, historyResponse);
        if (bundle && bundle.matchProviderId === fixtureId) bundles.push(bundle);
      } catch (error) {
        failures += 1;
        console.warn("FIVEDOLLAR_AUTHENTICATED_PRICE_UNAVAILABLE", JSON.stringify({
          fixtureId, error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
    console.log("FIVEDOLLAR_AUTHENTICATED_PRICE_POLL", JSON.stringify({
      attempted: ids.length, verified: bundles.length, failed: failures,
    }));
    return ok(bundles);
  }

  async fetchEventOdds(_matchProviderIds: string[]): Promise<ProviderResult<ProviderOddsBundle[]>> {
    return {
      ok: false, value: null, errorCode: "ODDS_NOT_SUPPORTED",
      errorMessage: "FiveDollar does not supply betting markets or prices",
      retryable: false,
    };
  }

  async fetchFixture(matchProviderId: string): Promise<ProviderResult<ProviderMatch>> {
    try {
      const fixtureId = String(matchProviderId).trim();
      if (!fixtureId) return fail("Match provider ID is required", "INVALID_MATCH_ID");

      const payload = await request<any>(
        `/fixtures/${encodeURIComponent(fixtureId)}`,
        { include: "events,stats" },
      );
      const fixture = payload?.data;
      if (!fixture) return fail("Fixture not found", "FIXTURE_NOT_FOUND");

      return ok(mapFixture(fixture, "football"));
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : String(error),
        "FIXTURE_FETCH_FAILED",
      );
    }
  }

  async fetchTeamFixtures(
    teamProviderId: string,
    options?: { page?: number; perPage?: number },
  ): Promise<ProviderResult<ProviderMatch[]>> {
    try {
      const teamId = String(teamProviderId).trim();
      if (!teamId) return fail("Team provider ID is required", "INVALID_TEAM_ID");

      const page = Math.max(1, Number(options?.page ?? 1));
      const perPage = Math.min(100, Math.max(1, Number(options?.perPage ?? 20)));

      const payload = await request<any>(
        `/teams/${encodeURIComponent(teamId)}/fixtures`,
        { page, per_page: perPage },
      );

      const fixtures = Array.isArray(payload?.data) ? payload.data : [];
      return ok(
        fixtures.filter((fixture: any) => !fixture?.esports).map((fixture: any) =>
          mapFixture(fixture, "football"),
        ),
      );
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : String(error),
        "TEAM_FIXTURES_FETCH_FAILED",
      );
    }
  }

  async fetchResult(matchProviderId: string): Promise<ProviderResult<ProviderResultSnapshot>> {
    try {
      const payload = await request<any>(`/fixtures/${encodeURIComponent(matchProviderId)}`);
      const fixture = payload?.data;
      if (!fixture) return fail("Fixture not found", "EVENT_NOT_FOUND");

      return ok({
        matchProviderId,
        status: statusOf(fixture),
        homeScore: score(fixture, "home"),
        awayScore: score(fixture, "away"),
        homeHalfScore: numberOrNull(fixture?.goals?.half_time?.home),
        awayHalfScore: numberOrNull(fixture?.goals?.half_time?.away),
        homeCorners: numberOrNull(fixture?.corners?.home),
        awayCorners: numberOrNull(fixture?.corners?.away),
        homeCards: (() => {
          const yellow = numberOrNull(fixture?.cards?.home?.yellow) ?? 0;
          const red = numberOrNull(fixture?.cards?.home?.red) ?? 0;
          return yellow + red || null;
        })(),
        awayCards: (() => {
          const yellow = numberOrNull(fixture?.cards?.away?.yellow) ?? 0;
          const red = numberOrNull(fixture?.cards?.away?.red) ?? 0;
          return yellow + red || null;
        })(),
        extraTime: false,
        penalties: false,
        penaltyHome: null,
        penaltyAway: null,
        revision: 1,
        observedAt: new Date().toISOString() as ISODateString,
        authoritative: true,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error), "RESULT_FETCH_FAILED");
    }
  }

  async fetchResults(
    from: ISODateString,
    to: ISODateString,
    matchProviderIds?: string[],
  ): Promise<ProviderResult<ProviderResultSnapshot[]>> {
    try {
      const allowed = matchProviderIds?.length ? new Set(matchProviderIds) : null;
      const matches = await this.fetchMatches({ from, to, sport: "football" });
      if (!matches.ok || !matches.value) return fail(matches.errorMessage || "Failed to fetch matches");

      const results: ProviderResultSnapshot[] = [];
      for (const match of matches.value) {
        if (allowed && !allowed.has(match.providerId)) continue;
        if (match.status !== "finished" && match.status !== "live") continue;

        results.push({
          matchProviderId: match.providerId,
          status: match.status,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          homeHalfScore: match.homeHalfScore ?? null,
          awayHalfScore: match.awayHalfScore ?? null,
          homeCorners: null,
          awayCorners: null,
          homeCards: null,
          awayCards: null,
          extraTime: false,
          penalties: false,
          penaltyHome: null,
          penaltyAway: null,
          revision: 1,
          observedAt: new Date().toISOString() as ISODateString,
          authoritative: true,
        });
      }

      return ok(results);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }
}
