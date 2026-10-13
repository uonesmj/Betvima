import { createRequestAdmissionQueue, type RequestPriority } from './odds-request-admission';
import { selectExtendedEventMarkets } from './extended-event-markets';
import type {
  ProviderMatch,
  ProviderOddsBundle,
  ProviderResult,
  ProviderResultSnapshot,
  SportsDataProvider,
} from "@/lib/ports/providers";

const BASE_URL =
  process.env.ODDS_API_BASE_URL ||
  (process.env.SPORTS_PROVIDER === "the_odds_api" ? process.env.SPORTS_PROVIDER_BASE_URL : "") ||
  "https://api.the-odds-api.com";

const API_KEY = process.env.ODDS_API_KEY || (process.env.SPORTS_PROVIDER === "the_odds_api" ? process.env.SPORTS_PROVIDER_API_KEY : "") || "";

const SPORT_KEYS = (process.env.ODDS_API_SPORT_KEYS || "soccer_epl")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const REGIONS = process.env.ODDS_API_REGIONS || "eu";
const US_SPORTS = new Set([
  "basketball",
  "american-football",
  "baseball",
]);
function regionsForSport(sportKey: string): string {
  const sport = sportFromKey(sportKey);
  const configured = process.env.ODDS_API_REGIONS?.trim();
  if (configured) return configured;

  if (sportKey === "basketball_nbl") {
    return "au";
  }

  if (
    sportKey === "icehockey_sweden_allsvenskan" ||
    sportKey === "icehockey_sweden_hockey_league" ||
    sportKey === "icehockey_liiga" ||
    sportKey === "icehockey_mestis"
  ) {
    return "eu";
  }

  return US_SPORTS.has(sport) ? "us" : REGIONS;
}
const MARKETS = process.env.ODDS_API_MARKETS || "h2h,spreads,totals";
const MAX_EVENTS = Math.max(
  1,
  Number(process.env.ODDS_API_MAX_EVENTS || 200),
);

type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
};

type OddsApiScore = OddsApiEvent & {
  completed?: boolean;
  scores?: Array<{
    name: string;
    score: string;
  }>;
  last_update?: string;
};

type OddsApiOutcome = {
  name: string;
  description?: string;
  price: number;
  point?: number;
};

type OddsApiMarket = {
  key: string;
  last_update?: string;
  outcomes: OddsApiOutcome[];
};

type OddsApiBookmaker = {
  key: string;
  title: string;
  last_update?: string;
  markets: OddsApiMarket[];
};

type OddsApiOddsEvent = OddsApiEvent & {
  bookmakers?: OddsApiBookmaker[];
};

type OddsApiEventMarket = {
  key: string;
  last_update?: string;
};

type OddsApiEventMarketsBookmaker = {
  key: string;
  title: string;
  markets?: OddsApiEventMarket[];
};

type OddsApiEventMarkets = OddsApiEvent & {
  bookmakers?: OddsApiEventMarketsBookmaker[];
};


const EXTENDED_MARKETS_BY_SPORT: Record<string, string> = {
  football: [
    "btts",
    "btts_h1",
    "double_chance",
    "double_chance_h1",
    "draw_no_bet",
    "correct_score",
    "correct_score_h1",
    "halftime_fulltime",
    "to_qualify",
    "corners_1x2",
    "alternate_spreads_corners",
    "alternate_totals_corners",
    "alternate_spreads_cards",
    "alternate_totals_cards",
    "alternate_team_totals_corners",
  ].join(","),
  basketball: [
    "alternate_spreads",
    "alternate_totals",
    "team_totals",
    "h2h_q1",
    "h2h_q2",
    "h2h_q3",
    "h2h_q4",
    "spreads_q1",
    "spreads_q2",
    "spreads_q3",
    "spreads_q4",
    "totals_q1",
    "totals_q2",
    "totals_q3",
    "totals_q4",
  ].join(","),
  "american-football": [
    "alternate_spreads",
    "alternate_totals",
    "team_totals",
    "h2h_q1",
    "h2h_q2",
    "h2h_q3",
    "h2h_q4",
    "spreads_q1",
    "spreads_q2",
    "spreads_q3",
    "spreads_q4",
    "totals_q1",
    "totals_q2",
    "totals_q3",
    "totals_q4",
  ].join(","),
  baseball: [
    "alternate_spreads",
    "alternate_totals",
    "team_totals",
    "h2h_1st_5_innings",
    "spreads_1st_5_innings",
    "totals_1st_5_innings",
  ].join(","),
  "ice-hockey": [
    "alternate_spreads",
    "alternate_totals",
    "team_totals",
  ].join(","),
  tennis: [
    "alternate_spreads",
    "alternate_totals",
  ].join(","),
  cricket: [
    "alternate_spreads",
    "alternate_totals",
  ].join(","),
  handball: [
    "alternate_spreads",
    "alternate_totals",
  ].join(","),
  volleyball: [
    "alternate_spreads",
    "alternate_totals",
  ].join(","),
  mma: "",
  boxing: "",
};

function extendedMarketsForSport(sportKey: string): string {
  const sport = sportFromKey(sportKey);
  const configured = process.env.ODDS_API_EXTENDED_MARKETS?.trim();
  if (configured) return configured;
  return EXTENDED_MARKETS_BY_SPORT[sport] || EXTENDED_MARKETS_BY_SPORT[sportKey] || "btts,double_chance,draw_no_bet,correct_score,halftime_fulltime,to_qualify";
}

const NOVA_DISCOVERY_EXCLUDED_MARKETS = new Set([
  "player_goal_scorer_anytime",
  "player_first_goal_scorer",
  "player_last_goal_scorer",
  "player_to_receive_card",
  "player_to_receive_red_card",
  "player_shots_on_target",
  "player_shots",
  "player_assists",
]);

async function discoverEventMarkets(
  sportKey: string,
  eventId: string,
): Promise<string[]> {
  const discovery = await request<OddsApiEventMarkets>(
    `/v4/sports/${encodeURIComponent(sportKey)}/events/${encodeURIComponent(eventId)}/markets`,
    {
      regions: regionsForSport(sportKey),
    },
    "extended",
    0, // No exponential 429 retries for optional markets: core pricing wins.
  );

  const discovered = new Set<string>();

  for (const bookmaker of discovery.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      const key = market.key?.trim();
      if (!key || NOVA_DISCOVERY_EXCLUDED_MARKETS.has(key)) continue;
      discovered.add(key);
    }
  }

  // This endpoint enumerates currently offered bookmaker markets. Do not
  // merge merely configured keys into this list: they may not be priced.
  return [...discovered];
}

function outcomeIdentity(
  marketKey: string,
  outcome: OddsApiOutcome,
): string {
  const description = outcome.description?.trim() || "";
  const point =
    outcome.point === undefined ? "" : String(outcome.point);
  const normalizedName = outcome.name.trim();

  if (description) {
    return `${normalizedName}:${description}:${point}`;
  }

  if (point) {
    return `${normalizedName}:${point}`;
  }

  return normalizedName;
}

function marketSpecifier(
  marketKey: string,
  outcomes: OddsApiOutcome[],
): string {
  const points = [
    ...new Set(
      outcomes
        .filter((outcome) => outcome.point !== undefined)
        .map((outcome) => String(outcome.point)),
    ),
  ];

  if (points.length === 1) return points[0] ?? "";

  if (points.length > 1) return points.join(",");

  return "";
}

function marketBuckets(
  marketKey: string,
  outcomes: OddsApiOutcome[],
): Array<{ specifier: string; outcomes: OddsApiOutcome[] }> {
  const pointValues = [
    ...new Set(
      outcomes
        .filter((outcome) => outcome.point !== undefined)
        .flatMap((outcome) =>
          String(outcome.point)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
    ),
  ];

  if (pointValues.length <= 1) {
    const specifier = pointValues[0] ?? "";
    return [{ specifier, outcomes }];
  }

  return pointValues.map((specifier) => ({
    specifier,
    outcomes: outcomes.filter(
      (outcome) =>
        outcome.point !== undefined &&
        String(outcome.point)
          .split(",")
          .map((value) => value.trim())
          .includes(specifier),
    ),
  }));
}

function makeMarketIdentity(
  marketKey: string,
  specifier: string,
): string {
  return `${marketKey}:${specifier}`;
}

function providerResult<T>(
  ok: boolean,
  value: T | null,
  errorMessage?: string,
): ProviderResult<T> {
  return {
    ok,
    value,
    ...(errorMessage ? { errorMessage } : {}),
    ...(errorMessage ? { retryable: true } : {}),
  };
}

function sportFromKey(sportKey: string): string {
  if (sportKey.startsWith("soccer_")) return "football";
  if (sportKey.startsWith("basketball_")) return "basketball";
  if (sportKey.startsWith("tennis_")) return "tennis";
  if (sportKey.startsWith("volleyball_")) return "volleyball";
  if (sportKey.startsWith("handball_")) return "handball";
  if (sportKey.startsWith("icehockey_")) return "ice-hockey";
  if (sportKey.startsWith("baseball_")) return "baseball";
  if (sportKey.startsWith("americanfootball_")) return "american-football";
  if (sportKey.startsWith("cricket_")) return "cricket";
  if (sportKey.startsWith("mma_")) return "mma";
  if (sportKey.startsWith("boxing_")) return "boxing";
  if (
    sportKey.startsWith("tabletennis_") ||
    sportKey.startsWith("table_tennis_")
  ) {
    return "table-tennis";
  }

  return "other";
}

function isLive(commenceTime: string): boolean {
  return new Date(commenceTime).getTime() <= Date.now();
}
function apiTimestamp(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function providerId(sportKey: string, eventId: string): string {
  return `${sportKey}:${eventId}`;
}

function eventIdFromProviderId(value: string): string {
  const index = value.indexOf(":");
  return index === -1 ? value : value.slice(index + 1);
}

function sportKeyFromProviderId(value: string): string | null {
  const index = value.indexOf(":");
  return index === -1 ? null : value.slice(0, index);
}

function scoreForTeam(
  scores: OddsApiScore["scores"],
  teamName: string,
): number | null {
  const row = scores?.find((item) => item.name === teamName);
  if (!row) return null;

  const parsed = Number(row.score);
  return Number.isFinite(parsed) ? parsed : null;
}

let quotaBlockedUntil = 0;
let frequencyBlockedUntil = 0;
// All odds requests share an upstream frequency cap, but fresh base prices
// must not sit behind a long queue of optional per-event market discovery.
const requestAdmission = createRequestAdmissionQueue();
let lastRequestStartedAt = 0;

const QUOTA_COOLDOWN_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.ODDS_API_QUOTA_COOLDOWN_SECONDS || 900) * 1000,
);

const REQUEST_MIN_INTERVAL_MS = Math.max(
  1000,
  Number(process.env.ODDS_API_MIN_INTERVAL_MS || 1500),
);

const FREQUENCY_COOLDOWN_MS = Math.max(
  5 * 1000,
  Number(process.env.ODDS_API_FREQ_COOLDOWN_SECONDS || 10) * 1000,
);

const MAX_FREQ_RETRIES = Math.max(
  1,
  Number(process.env.ODDS_API_FREQ_RETRIES || 3),
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRequestSlot(priority: RequestPriority): Promise<void> {
  const release = await requestAdmission.acquire(priority);
  try {
    const now = Date.now();
    if (now < frequencyBlockedUntil) {
      await sleep(frequencyBlockedUntil - now);
    }
    const elapsed = Date.now() - lastRequestStartedAt;
    if (elapsed < REQUEST_MIN_INTERVAL_MS) {
      await sleep(REQUEST_MIN_INTERVAL_MS - elapsed);
    }
    lastRequestStartedAt = Date.now();
  } finally {
    release();
  }
}

async function request<T>(
  path: string,
  params: Record<string, string> = {},
  priority: RequestPriority = "core",
  maxRetriesOverride?: number,
): Promise<T> {
  if (!API_KEY) {
    throw new Error("SPORTS_PROVIDER_API_KEY is not configured");
  }

  const quotaSensitive = path.includes("/odds/") || path.includes("/scores/");

  if (quotaSensitive && Date.now() < quotaBlockedUntil) {
    throw new Error(
      `OUT_OF_USAGE_CREDITS: local circuit breaker active for ${Math.ceil(
        (quotaBlockedUntil - Date.now()) / 1000,
      )}s`,
    );
  }

  let lastError: Error | null = null;

  const retryLimit = maxRetriesOverride ?? MAX_FREQ_RETRIES;
  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    await waitForRequestSlot(priority);

    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("apiKey", API_KEY);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let response: Response;

    try {
      response = await fetch(url, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `The Odds API request timeout after 15000ms: ${path}`,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");

      if (
        response.status === 429 &&
        body.includes("EXCEEDED_FREQ_LIMIT")
      ) {
        lastError = new Error(
          `The Odds API 429: ${body.slice(0, 300)}`,
        );

        frequencyBlockedUntil =
          Date.now() + FREQUENCY_COOLDOWN_MS;

        if (attempt < retryLimit) {
          await sleep(
            FREQUENCY_COOLDOWN_MS * Math.max(1, attempt + 1),
          );
          continue;
        }

        throw lastError;
      }

      if (
        response.status === 401 &&
        body.includes("OUT_OF_USAGE_CREDITS")
      ) {
        quotaBlockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
        throw new Error(
          `OUT_OF_USAGE_CREDITS: The Odds API quota exhausted`,
        );
      }

      throw new Error(
        `The Odds API ${response.status}: ${body.slice(0, 300)}`,
      );
    }

    const remaining = response.headers.get("x-requests-remaining");

    if (quotaSensitive && remaining === "0") {
      quotaBlockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
    }

    return (await response.json()) as T;
  }

  throw lastError ?? new Error(`The Odds API request failed: ${path}`);
}

export class TheOddsApiSportsProvider implements SportsDataProvider {
  readonly name = "the_odds_api";
  readonly configured = Boolean(API_KEY);

  async health() {
    const requiredEnv = [
      "SPORTS_PROVIDER_BASE_URL",
      "SPORTS_PROVIDER_API_KEY",
    ];

    if (!API_KEY) {
      return {
        provider: this.name,
        category: "sports" as const,
        configured: false,
        enabled: true,
        reachable: false,
        lastError: "SPORTS_PROVIDER_API_KEY is not configured",
        lastSuccessAt: null,
        requiredEnv,
        notes: "The Odds API is not configured.",
      };
    }

    try {
      await request("/v4/sports/");
      return {
        provider: this.name,
        category: "sports" as const,
        configured: true,
        enabled: true,
        reachable: true,
        lastError: null,
        lastSuccessAt: new Date().toISOString(),
        requiredEnv,
        notes: "The Odds API is reachable.",
      };
    } catch (error) {
      return {
        provider: this.name,
        category: "sports" as const,
        configured: true,
        enabled: true,
        reachable: false,
        lastError:
          error instanceof Error ? error.message : "Provider request failed",
        lastSuccessAt: null,
        requiredEnv,
        notes: "The Odds API is configured but unreachable.",
      };
    }
  }

  async fetchMatches(window: {
    from: string;
    to: string;
    sport?: string;
  }): Promise<ProviderResult<ProviderMatch[]>> {
    const keys = window.sport
      ? SPORT_KEYS.filter((key) => sportFromKey(key) === window.sport)
      : SPORT_KEYS;

    const from = apiTimestamp(
      new Date(
        Math.min(
          new Date(window.from).getTime(),
          Date.now() - 24 * 60 * 60 * 1000,
        ),
      ),
    );

    const to = new Date(window.to).getTime();
    const allByProviderId = new Map<string, ProviderMatch>();
    const failedSports: string[] = [];

    const DISCOVERY_CONCURRENCY = Math.max(
      1,
      Math.min(8, Number(process.env.ODDS_API_DISCOVERY_CONCURRENCY || 6)),
    );

    const processSport = async (sportKey: string): Promise<void> => {
      const sportMatches = new Map<string, ProviderMatch>();

      const [eventsResult, liveOddsResult, scoresResult] =
        await Promise.allSettled([
          request<OddsApiEvent[]>(
            `/v4/sports/${encodeURIComponent(sportKey)}/events`,
            {
              commenceTimeFrom: from,
              commenceTimeTo: apiTimestamp(new Date(to)),
            },
          ),
          request<OddsApiOddsEvent[]>(
            `/v4/sports/${encodeURIComponent(sportKey)}/odds/`,
            {
              regions: regionsForSport(sportKey),
              markets: "h2h",
              oddsFormat: "decimal",
            },
          ),
          request<OddsApiScore[]>(
            `/v4/sports/${encodeURIComponent(sportKey)}/scores/`,
            {
              daysFrom: "1",
            },
          ),
        ]);

      if (eventsResult.status === "fulfilled") {
        for (const event of eventsResult.value.slice(0, MAX_EVENTS)) {
          const match: ProviderMatch = {
            providerId: providerId(sportKey, event.id),
            sport: sportFromKey(sportKey),
            leagueProviderId: sportKey,
            leagueName: event.sport_title,
            countryCode: null,
            homeTeamName: event.home_team,
            awayTeamName: event.away_team,
            scheduledAt: event.commence_time,
            status: "scheduled",
            homeScore: null,
            awayScore: null,
            minute: null,
            period: null,
          };

          sportMatches.set(match.providerId, match);
        }
      } else {
        failedSports.push(sportKey);
        console.warn(
          "ODDS_MATCH_DISCOVERY_SKIP",
          JSON.stringify({
            sportKey,
            stage: "events",
            error:
              eventsResult.reason instanceof Error
                ? eventsResult.reason.message
                : String(eventsResult.reason),
          }),
        );
      }

      if (liveOddsResult.status === "fulfilled") {
        for (const event of liveOddsResult.value) {
          if (!isLive(event.commence_time)) continue;

          const id = providerId(sportKey, event.id);
          const existing = sportMatches.get(id);

          if (existing) {
            existing.status = "live";
          } else {
            sportMatches.set(id, {
              providerId: id,
              sport: sportFromKey(sportKey),
              leagueProviderId: sportKey,
              leagueName: event.sport_title || sportKey,
              countryCode: null,
              homeTeamName: event.home_team,
              awayTeamName: event.away_team,
              scheduledAt: event.commence_time,
              status: "live",
              homeScore: null,
              awayScore: null,
              minute: null,
              period: null,
            });
          }
        }
      } else {
        failedSports.push(sportKey);
        console.warn(
          "ODDS_LIVE_DISCOVERY_SKIP",
          JSON.stringify({
            sportKey,
            stage: "odds",
            error:
              liveOddsResult.reason instanceof Error
                ? liveOddsResult.reason.message
                : String(liveOddsResult.reason),
          }),
        );
      }

      if (scoresResult.status === "fulfilled") {
        for (const event of scoresResult.value) {
          const timestamp = new Date(event.commence_time).getTime();

          if (!Number.isFinite(timestamp)) continue;
          if (timestamp > Date.now()) continue;

          const id = providerId(sportKey, event.id);
          const existing = sportMatches.get(id);

          if (event.completed) {
            if (existing && existing.status !== "finished") {
              existing.status = "finished";
              existing.homeScore = scoreForTeam(
                event.scores,
                event.home_team,
              );
              existing.awayScore = scoreForTeam(
                event.scores,
                event.away_team,
              );
            }
            continue;
          }

          if (existing) {
            existing.status = "live";
            existing.homeScore = scoreForTeam(
              event.scores,
              event.home_team,
            );
            existing.awayScore = scoreForTeam(
              event.scores,
              event.away_team,
            );
          } else {
            sportMatches.set(id, {
              providerId: id,
              sport: sportFromKey(sportKey),
              leagueProviderId: sportKey,
              leagueName: event.sport_title || sportKey,
              countryCode: null,
              homeTeamName: event.home_team,
              awayTeamName: event.away_team,
              scheduledAt: event.commence_time,
              status: "live",
              homeScore: scoreForTeam(event.scores, event.home_team),
              awayScore: scoreForTeam(event.scores, event.away_team),
              minute: null,
              period: null,
            });
          }
        }
      } else {
        failedSports.push(sportKey);
        console.warn(
          "ODDS_LIVE_DISCOVERY_SKIP",
          JSON.stringify({
            sportKey,
            stage: "scores",
            error:
              scoresResult.reason instanceof Error
                ? scoresResult.reason.message
                : String(scoresResult.reason),
          }),
        );
      }

      for (const [id, match] of sportMatches) {
        allByProviderId.set(id, match);
      }
    };

    for (let offset = 0; offset < keys.length; offset += DISCOVERY_CONCURRENCY) {
      const batch = keys.slice(offset, offset + DISCOVERY_CONCURRENCY);
      await Promise.all(batch.map(processSport));
    }

    console.log(
      "ODDS_MULTISPORT_DISCOVERY_RESULT",
      JSON.stringify({
        requestedSports: keys.length,
        concurrency: DISCOVERY_CONCURRENCY,
        failedSports: [...new Set(failedSports)],
        successfulSports: keys.length - new Set(failedSports).size,
        matches: allByProviderId.size,
        liveMatches: [...allByProviderId.values()].filter(
          (match) => match.status === "live",
        ).length,
      }),
    );

    return providerResult(true, [...allByProviderId.values()]);
  }

  async fetchLiveMatches(
    sport?: string,
  ): Promise<ProviderResult<ProviderMatch[]>> {
    const keys = sport
      ? SPORT_KEYS.filter((key) => sportFromKey(key) === sport)
      : SPORT_KEYS;

    const liveMatches: ProviderMatch[] = [];
    const failedSports: string[] = [];
    const DISCOVERY_CONCURRENCY = Math.max(
      1,
      Math.min(8, Number(process.env.ODDS_API_DISCOVERY_CONCURRENCY || 6)),
    );

    const processSport = async (sportKey: string): Promise<void> => {
      try {
        const odds = await request<OddsApiOddsEvent[]>(
          `/v4/sports/${encodeURIComponent(sportKey)}/odds/`,
          {
            regions: regionsForSport(sportKey),
            markets: "h2h",
            oddsFormat: "decimal",
          },
        );

        const now = Date.now();

        for (const event of odds) {
          const commenceMs = new Date(event.commence_time).getTime();

          if (!Number.isFinite(commenceMs) || commenceMs > now) continue;

          liveMatches.push({
            providerId: `${sportKey}:${event.id}`,
            sport: sportFromKey(sportKey),
            leagueProviderId: sportKey,
            leagueName: event.sport_title ?? sportKey,
            countryCode: null,
            homeTeamName: event.home_team,
            awayTeamName: event.away_team,
            scheduledAt: event.commence_time,
            status: "live",
            homeScore: null,
            awayScore: null,
            minute: null,
            period: null,
          });
        }
      } catch (error) {
        failedSports.push(sportKey);
        console.error(
          "ODDS_LIVE_ODDS_DISCOVERY_FAILED",
          JSON.stringify({
            sportKey,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    };

    for (let offset = 0; offset < keys.length; offset += DISCOVERY_CONCURRENCY) {
      const batch = keys.slice(offset, offset + DISCOVERY_CONCURRENCY);
      await Promise.all(batch.map(processSport));
    }

    const unique = new Map<string, ProviderMatch>();
    for (const match of liveMatches) {
      unique.set(match.providerId, match);
    }

    const result = [...unique.values()];

    console.log(
      "ODDS_LIVE_ODDS_DISCOVERY_RESULT",
      JSON.stringify({
        requestedSports: keys.length,
        concurrency: DISCOVERY_CONCURRENCY,
        failedSports: [...new Set(failedSports)],
        successfulSports: keys.length - new Set(failedSports).size,
        liveMatches: result.length,
        sample: result.slice(0, 30).map((match) => ({
          providerId: match.providerId,
          sport: match.sport,
          league: match.leagueName,
          home: match.homeTeamName,
          away: match.awayTeamName,
          scheduledAt: match.scheduledAt,
        })),
      }),
    );

    return providerResult(true, result);
  }

  async fetchOdds(
    matchProviderIds: string[],
  ): Promise<ProviderResult<ProviderOddsBundle[]>> {
    try {
      const grouped = new Map<string, string[]>();

      for (const providerIdValue of matchProviderIds) {
        const sportKey = sportKeyFromProviderId(providerIdValue);
        if (!sportKey) continue;

        const current = grouped.get(sportKey) || [];
        current.push(eventIdFromProviderId(providerIdValue));
        grouped.set(sportKey, current);
      }

      const bundles = new Map<string, ProviderOddsBundle>();
      // A 12-event fixture batch can span 10+ sports, and each grouped request
      // has a 15s network timeout. Unlimited sequential requests used to hold
      // the main 180s odds lock, letting every 5m quote expire together.
      // Finish the current request and publish already-fetched sport bundles
      // rather than make another call once the wall budget is consumed.
      const coreStartedAt = Date.now();
      const coreBudgetMs = 45_000;
      let successfulRequests = 0;
      let failedRequests = 0;
      let firstError: string | null = null;
      let skippedForBudget = 0;

      for (const [sportKey, eventIds] of grouped) {
        for (let offset = 0; offset < eventIds.length; offset += 50) {
          if (Date.now() - coreStartedAt >= coreBudgetMs) {
            skippedForBudget += Math.ceil((eventIds.length-offset)/50);
            console.warn("ODDS_CORE_REQUEST_BUDGET_EXHAUSTED", JSON.stringify({
              elapsedMs: Date.now()-coreStartedAt,
              completedRequests: successfulRequests+failedRequests,
              processedBundles: bundles.size,
              skippedCurrentSport: sportKey,
            }));
            break;
          }
          const batch = eventIds.slice(offset, offset + 50);

          console.log("ODDS_PROVIDER_BATCH_REQUEST", JSON.stringify({
            sportKey,
            requestedEvents: batch.length,
            eventIds: batch,
            markets: MARKETS,
          }));
          let events: OddsApiOddsEvent[];
          try {
            events = await request<OddsApiOddsEvent[]>(
              `/v4/sports/${encodeURIComponent(sportKey)}/odds/`,
              {
                regions: regionsForSport(sportKey),
                markets: MARKETS.split(",").map((value) => value.trim()).filter(Boolean).join(","),
                oddsFormat: "decimal",
                eventIds: batch.join(","),
              },
              "core",
              1, // 429: one bounded retry; do not block the entire odds lock
            );
            successfulRequests += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("OUT_OF_USAGE_CREDITS")) throw error;
            failedRequests += 1;
            firstError ??= message;
            console.warn("ODDS_PROVIDER_SPORT_BATCH_FAILED", JSON.stringify({
              sportKey, requestedEvents: batch.length,
              error: message.slice(0, 220),
              elapsedMs: Date.now()-coreStartedAt,
            }));
            // Preserve all successfully fetched sport bundles. One unavailable
            // league is not grounds to throw away unrelated fresh prices.
            continue;
          }
          console.log("ODDS_PROVIDER_BATCH_RESPONSE", JSON.stringify({
            sportKey,
            requestedEvents: batch.length,
            returnedEvents: events.length,
            returnedEventIds: events.map((event) => event.id),
            missingEventIds: batch.filter((id) => !events.some((event) => event.id === id)),
          }));

          for (const event of events) {
            const markets = new Map<
              string,
              {
                providerId: string;
                key: string;
                type: string;
                specifier: string | null;
                isLive: boolean;
                status: string;
                selections: Array<
                  ProviderOddsBundle["markets"][number]["selections"][number] & {
                    sourceUpdatedAt?: string;
                  }
                >;
                sourceUpdatedAt: string;
              }
            >();

              for (const bookmaker of event.bookmakers || []) {
              for (const market of bookmaker.markets || []) {
                const sourceUpdatedAt =
                  market.last_update ||
                  bookmaker.last_update ||
                  new Date().toISOString();

                for (const bucket of marketBuckets(
                    market.key,
                    market.outcomes || [],
                  )) {
                    const specifier = bucket.specifier;
                    const marketIdentityKey = makeMarketIdentity(
                      market.key,
                      specifier,
                    );
                    const existing =
                      markets.get(marketIdentityKey) ||
                      {
                        providerId: `${bookmaker.key}:${market.key}:${specifier}`,
                        key: market.key,
                        type: market.key,
                        specifier,
                        isLive: isLive(event.commence_time),
                        status: "open",
                        selections: [],
                      };

                    const byCode = new Map(
                      existing.selections.map((selection) => [
                        selection.code,
                        selection,
                      ]),
                    );

                    for (const outcome of bucket.outcomes) {
                      if (!Number.isFinite(outcome.price) || outcome.price <= 1) {
                        continue;
                      }

                      let code = outcome.name;

                      if (outcome.name === event.home_team) code = "HOME";
                      else if (outcome.name === event.away_team) code = "AWAY";
                      else if (outcome.name.toLowerCase() === "draw") code = "DRAW";

                      const odds = outcome.price.toFixed(4);

                      if (!odds) continue;

                      const current = byCode.get(code);


                      const incomingTimestamp = new Date(sourceUpdatedAt).getTime();


                      const currentSourceUpdatedAt =


                        current && "sourceUpdatedAt" in current


                          ? current.sourceUpdatedAt


                          : null;


                      const currentTimestamp = currentSourceUpdatedAt


                        ? new Date(currentSourceUpdatedAt).getTime()


                        : Number.NEGATIVE_INFINITY;



                      if (


                        !current ||


                        (Number.isFinite(incomingTimestamp) &&


                          incomingTimestamp >= currentTimestamp)


                      ) {


                        byCode.set(code, {


                          providerId: `${bookmaker.key}:${market.key}:${specifier}:${code}`,


                          code,


                          name: outcome.description


                            ? `${outcome.description} · ${outcome.name}`


                            : outcome.name,


                          line:


                            outcome.point === undefined


                              ? null


                              : String(outcome.point),


                          odds: String(odds),


                          status: "open",


                          sourceUpdatedAt:
                          [...byCode.values()]
                            .map((selection) => selection.sourceUpdatedAt)
                            .filter((value): value is string => Boolean(value))
                            .sort(
                              (a, b) =>
                                new Date(b).getTime() - new Date(a).getTime(),
                            )[0] || sourceUpdatedAt,


                        });


                      }
                    }

                    if (byCode.size > 0) {
                      markets.set(marketIdentityKey, {
                        providerId: `${bookmaker.key}:${market.key}:${specifier}`,
                        key: market.key,
                        type: market.key,
                        specifier,
                        isLive: isLive(event.commence_time),
                        status: "open",
                        selections: [...byCode.values()],
                        sourceUpdatedAt:
                          [...byCode.values()]
                            .map((selection) => selection.sourceUpdatedAt)
                            .filter((value): value is string => Boolean(value))
                            .sort(
                              (a, b) =>
                                new Date(b).getTime() - new Date(a).getTime(),
                            )[0] || sourceUpdatedAt,
                      });
                    }
                  }
                }
              }

            bundles.set(providerId(sportKey, event.id), {
              matchProviderId: providerId(sportKey, event.id),
              markets: [...markets.values()],
              updatedAt:
                [...markets.values()]
                  .map((market) => market.sourceUpdatedAt)
                  .filter(Boolean)
                  .sort(
                    (a, b) =>
                      new Date(b).getTime() - new Date(a).getTime(),
                  )[0] || new Date().toISOString(),
            });
          }
        }
      }

      console.log("ODDS_PROVIDER_CORE_BATCH_SUMMARY", JSON.stringify({
        sports: grouped.size,
        successfulRequests,
        failedRequests,
        skippedForBudget,
        fetchedBundles: bundles.size,
        elapsedMs: Date.now()-coreStartedAt,
      }));
      if (successfulRequests === 0 && failedRequests > 0) {
        return providerResult(false, [], firstError ?? "All grouped bookmaker requests failed");
      }
      return providerResult(true, [...bundles.values()]);
    } catch (error) {
      return providerResult(
        false,
        [],
        error instanceof Error ? error.message : "Provider request failed",
      );
    }
  }

  async fetchEventOdds(
    matchProviderIds: string[],
  ): Promise<ProviderResult<ProviderOddsBundle[]>> {
    try {
      const results: ProviderOddsBundle[] = [];
      const seen = new Set<string>();
      const startedAt = Date.now();
      // Two network calls per fixture can otherwise hold the extended lock
      // for minutes and compete with five-minute base-market freshness.
      const extendedBudgetMs = 35_000;
      let attempted = 0;
      let requestFailures = 0;

      for (const matchProviderId of matchProviderIds) {
        if (Date.now() - startedAt >= extendedBudgetMs) {
          console.warn("ODDS_EXTENDED_BUDGET_EXHAUSTED", JSON.stringify({
            attempted, receivedBundles: results.length,
            elapsedMs: Date.now()-startedAt,
            remaining: matchProviderIds.length-attempted,
          }));
          break;
        }
        attempted += 1;
        const sportKey = sportKeyFromProviderId(matchProviderId);
        const eventId = eventIdFromProviderId(matchProviderId);
        if (!sportKey || !eventId || seen.has(matchProviderId)) continue;
        seen.add(matchProviderId);

        let event: OddsApiOddsEvent;
        try {
          // The grouped /odds endpoint already covers h2h, spreads and totals.
          // Querying those again per event starved the missing extended markets.
          // Only buy supported extended markets actually listed by bookmakers.
          let discoveredMarkets: string[];
          try {
            discoveredMarkets = await discoverEventMarkets(sportKey, eventId);
          } catch (discoveryError) {
            const detail = discoveryError instanceof Error ? discoveryError.message : String(discoveryError);
            if (detail.includes("OUT_OF_USAGE_CREDITS") || detail.includes("The Odds API 429")) {
              throw discoveryError;
            }
            console.warn("ODDS_EVENT_MARKET_DISCOVERY_UNAVAILABLE", JSON.stringify({
              matchProviderId,
              sportKey,
              error: discoveryError instanceof Error
                ? discoveryError.message : String(discoveryError),
            }));
            continue;
          }
          const configuredLimit = Number(process.env.ODDS_API_EVENT_MARKET_LIMIT || 20);
          const requestedMarkets = selectExtendedEventMarkets(
            extendedMarketsForSport(sportKey), discoveredMarkets, MARKETS, configuredLimit,
          );
          if (requestedMarkets.length === 0) {
            console.log("ODDS_EVENT_EXTENDED_NO_MARKETS", JSON.stringify({
              matchProviderId,
              sportKey,
              discovered: discoveredMarkets.length,
            }));
            continue;
          }
          const markets = requestedMarkets.join(",");
          console.info("ODDS_EVENT_EXTENDED_MARKETS_REQUEST", JSON.stringify({
            matchProviderId,
            sportKey,
            discovered: discoveredMarkets.length,
            markets,
          }));
          event = await request<OddsApiOddsEvent>(
            `/v4/sports/${encodeURIComponent(sportKey)}/events/${encodeURIComponent(eventId)}/odds`,
            {
              regions: regionsForSport(sportKey),
              markets,
              oddsFormat: "decimal",
            },
            "extended",
            0, // Optional requests must never back off for 10+20+30 seconds.
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (
            message.includes("EVENT_NOT_FOUND") ||
            message.includes("The Odds API 404")
          ) {
            console.warn(
              "ODDS_EVENT_SKIP",
              JSON.stringify({ matchProviderId, reason: "EVENT_NOT_FOUND" }),
            );
            continue;
          }

          if (
            message.includes("INVALID_MARKET") ||
            message.includes('"error_code":"INVALID_MARKET"') ||
            message.includes("Invalid markets:")
          ) {
            console.warn(
              "ODDS_EVENT_EXTENDED_SKIP",
              JSON.stringify({
                matchProviderId,
                sportKey,
                reason: "INVALID_MARKET",
                error: message,
              }),
            );
            continue;
          }

          if (message.includes("OUT_OF_USAGE_CREDITS")) throw error;
          if (message.includes("The Odds API 429")) {
            console.warn("ODDS_EXTENDED_RATE_LIMIT_STOP", JSON.stringify({
              attempted, receivedBundles: results.length, elapsedMs: Date.now()-startedAt,
            }));
            break;
          }
          requestFailures += 1;
          console.warn("ODDS_EXTENDED_EVENT_FETCH_FAILED", JSON.stringify({
            matchProviderId, sportKey, error: message.slice(0, 200),
          }));
          // Never throw away previously fetched valid events because another
          // sport or bookmaker has a transient network error.
          continue;
        }

        const markets = new Map<
          string,
          {
            providerId: string;
            key: string;
            type: string;
            specifier: string | null;
            isLive: boolean;
            status: string;
            selections: Array<
                  ProviderOddsBundle["markets"][number]["selections"][number] & {
                    sourceUpdatedAt?: string;
                  }
                >;
                sourceUpdatedAt: string;
          }
        >();

          for (const bookmaker of event.bookmakers || []) {
            for (const market of bookmaker.markets || []) {
              const sourceUpdatedAt =
                market.last_update ||
                bookmaker.last_update ||
                new Date().toISOString();

              for (const bucket of marketBuckets(
                market.key,
                market.outcomes || [],
              )) {
                const specifier = bucket.specifier;
                const marketIdentityKey = makeMarketIdentity(
                  market.key,
                  specifier,
                );

                const existing =
                  markets.get(marketIdentityKey) ||
                  {
                    providerId: `${bookmaker.key}:${market.key}:${specifier}`,
                    key: market.key,
                    type: market.key,
                    specifier,
                    isLive: isLive(event.commence_time),
                    status: "open",
                    selections: [],
                  };

                const byCode = new Map(
                  existing.selections.map((selection) => [
                    selection.code,
                    selection,
                  ]),
                );

                for (const outcome of bucket.outcomes) {
                  if (!Number.isFinite(outcome.price) || outcome.price <= 1) {
                    continue;
                  }

                  let code = outcome.name;
                  if (outcome.name === event.home_team) code = "HOME";
                  else if (outcome.name === event.away_team) code = "AWAY";
                  else if (outcome.name.toLowerCase() === "draw") code = "DRAW";

                  const odds = outcome.price.toFixed(4);
                  if (!odds) continue;

                  const current = byCode.get(code);


                  const incomingTimestamp = new Date(sourceUpdatedAt).getTime();


                  const currentSourceUpdatedAt =


                    current && "sourceUpdatedAt" in current


                      ? current.sourceUpdatedAt


                      : null;


                  const currentTimestamp = currentSourceUpdatedAt


                    ? new Date(currentSourceUpdatedAt).getTime()


                    : Number.NEGATIVE_INFINITY;



                  if (


                    !current ||


                    (Number.isFinite(incomingTimestamp) &&


                      incomingTimestamp >= currentTimestamp)


                  ) {


                    byCode.set(code, {


                      providerId: `${bookmaker.key}:${market.key}:${specifier}:${code}`,


                      code,


                      name: outcome.description


                        ? `${outcome.description} · ${outcome.name}`


                        : outcome.name,


                      line:


                        outcome.point === undefined


                          ? null


                          : String(outcome.point),


                      odds: String(odds),


                      status: "open",


                      sourceUpdatedAt,


                    });


                  }
                }

                if (byCode.size > 0) {
                  markets.set(marketIdentityKey, {
                    providerId: `${bookmaker.key}:${market.key}:${specifier}`,
                    key: market.key,
                    type: market.key,
                    specifier,
                    isLive: isLive(event.commence_time),
                    status: "open",
                    selections: [...byCode.values()],
                    sourceUpdatedAt,
                  });
                }
              }
            }
          }

        results.push({
          matchProviderId,
          markets: [...markets.values()],
          updatedAt:
            event.bookmakers
              ?.map((bookmaker) => bookmaker.last_update)
              .filter((value): value is string => Boolean(value))
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ||
            new Date().toISOString(),
        });
      }

      console.log("ODDS_EXTENDED_BATCH_SUMMARY", JSON.stringify({
        attempted, requested: matchProviderIds.length,
        returnedBundles: results.length, requestFailures,
        elapsedMs: Date.now()-startedAt,
      }));
      return providerResult(true, results);
    } catch (error) {
      return providerResult(
        false,
        [],
        error instanceof Error ? error.message : "Provider event odds request failed",
      );
    }
  }

  async fetchResult(
    matchProviderId: string,
  ): Promise<ProviderResult<ProviderResultSnapshot>> {
    try {
      const sportKey = sportKeyFromProviderId(matchProviderId);
      const eventId = eventIdFromProviderId(matchProviderId);

      if (!sportKey) {
        return providerResult(false, null as never, "Invalid provider match ID");
      }

      const scores = await request<OddsApiScore[]>(
        `/v4/sports/${encodeURIComponent(sportKey)}/scores/`,
        {
          daysFrom: "3",
          eventIds: eventId,
        },
      );

      const event = scores.find((item) => item.id === eventId);

      if (!event) {
        return providerResult(false, null as never, "Event not found");
      }

      return providerResult(true, {
        matchProviderId,
        status: event.completed ? "finished" : "live",
        homeScore: scoreForTeam(event.scores, event.home_team),
        awayScore: scoreForTeam(event.scores, event.away_team),
        homeHalfScore: null,
        awayHalfScore: null,
        homeCorners: null,
        awayCorners: null,
        homeCards: null,
        awayCards: null,
        extraTime: false,
        penalties: false,
        penaltyHome: null,
        penaltyAway: null,
        revision: 1,
        observedAt: event.last_update || new Date().toISOString(),
        authoritative: true,
      });
    } catch (error) {
      return providerResult(
        false,
        null as never,
        error instanceof Error ? error.message : "Provider request failed",
      );
    }
  }

  async fetchResults(
    from: string,
    to: string,
    matchProviderIds?: string[],
  ): Promise<ProviderResult<ProviderResultSnapshot[]>> {
    try {
      const results: ProviderResultSnapshot[] = [];
      const fromMs = new Date(from).getTime();
      const toMs = new Date(to).getTime();

      const grouped = new Map<string, string[]>();

      if (matchProviderIds && matchProviderIds.length > 0) {
        for (const value of matchProviderIds) {
          const sportKey = sportKeyFromProviderId(value);
          const eventId = eventIdFromProviderId(value);
          if (!sportKey || !eventId) continue;

          const current = grouped.get(sportKey) || [];
          current.push(eventId);
          grouped.set(sportKey, current);
        }
      } else {
        for (const sportKey of SPORT_KEYS) {
          grouped.set(sportKey, []);
        }
      }

      for (const [sportKey, eventIds] of grouped) {
        const batches =
          eventIds.length > 0
            ? Array.from(
                { length: Math.ceil(eventIds.length / 50) },
                (_, index) => eventIds.slice(index * 50, index * 50 + 50),
              )
            : [[]];

        for (const batch of batches) {
          const params: Record<string, string> = {};

          if (batch.length > 0) {
            params.eventIds = batch.join(",");
            params.daysFrom = "3";
          } else {
            params.daysFrom = "3";
          }

          const events = await request<OddsApiScore[]>(
            `/v4/sports/${encodeURIComponent(sportKey)}/scores/`,
            params,
          );

          for (const event of events) {
            const timestamp = new Date(event.commence_time).getTime();

            if (timestamp < fromMs || timestamp > toMs) continue;

            if (!event.completed && timestamp > Date.now()) continue;

              results.push({
              matchProviderId: providerId(sportKey, event.id),
              status: event.completed ? "finished" : "live",
              homeScore: scoreForTeam(event.scores, event.home_team),
              awayScore: scoreForTeam(event.scores, event.away_team),
              homeHalfScore: null,
              awayHalfScore: null,
              homeCorners: null,
              awayCorners: null,
              homeCards: null,
              awayCards: null,
              extraTime: false,
              penalties: false,
              penaltyHome: null,
              penaltyAway: null,
              revision: 1,
              observedAt: event.last_update || new Date().toISOString(),
              authoritative: true,
            });
          }
        }
      }

      return providerResult(true, results);
    } catch (error) {
      return providerResult(
        false,
        [],
        error instanceof Error ? error.message : "Provider request failed",
      );
    }
  }
}
