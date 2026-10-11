console.log("NOVA_ODDS_WORKER_RUNTIME_MARKER", JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), cwd: process.cwd() }));
/**
 * ODDS WORKER
 * Ingests provider odds, writes only changed prices as new versions (with history),
 * flags anomalies, suspends stale feeds, and queues settlement work when a match ends.
 * With no sports provider configured it performs NO changes and records the honest
 * provider status instead of inventing data.
 */
import { createWorker, type WorkerContext, type JobHandler } from './runtime';
import { serverEnv } from '@/server/env';
import { pgArray } from '@/server/db/rows';
import {
  hasRejecting,
  hasSuspending,
  detectOddsAnomalies,
  oddsFromDecimalString,
} from '@/domain/odds';
import { marketRuleFor, marketDisplayOrder } from '@/domain/market-rules';
import { resolveTeamLogo, resolveLeagueLogo } from "@/server/services/logo-resolver";
import type { LiveFixture, LiveEvent, LiveStatistics } from '@/lib/ports/live-data-provider';

const env = serverEnv();
const WORKER_MODE = String(process.env.ODDS_WORKER_MODE ?? "bulk").trim().toLowerCase();

const handlers: JobHandler[] = [
  {
    kinds: ['odds.sync'],
    async handle(job, ctx: WorkerContext) {
      return syncOdds(ctx, String(job.payload.matchId ?? ''));
    },
  },
  {
    kinds: ['match.sync'],
    async handle(_job, ctx: WorkerContext) {
      return syncMatches(ctx);
    },
  },
];

let lastResultReconciliationAt = 0;
let lastPrematchNearOddsAt = 0;
let lastPrematchMidOddsAt = 0;
let lastPrematchFarOddsAt = 0;
let lastResultsQuotaErrorAt = 0;
let lastLiveOddsAt = 0;
let lastExtendedLiveOddsAt = 0;
let lastExtendedPrematchNearOddsAt = 0;
let lastExtendedPrematchFarOddsAt = 0;
let lastMatchDiscoveryAt = 0;
let lastApiFootballLiveSyncAt = 0;
const MATCH_DISCOVERY_INTERVAL_MS = process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? 10 * 60_000 : 5 * 60_000;
const PREMATCH_NEAR_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? 60_000 : 30_000;
const PREMATCH_MID_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? 5 * 60_000 : 60_000;
const PREMATCH_FAR_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? 15 * 60_000 : 5 * 60_000;
const LIVE_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? 30_000 : 5_000;
const EXTENDED_LIVE_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? 10 * 60_000 : 5 * 60_000;
const EXTENDED_PREMATCH_NEAR_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? 10 * 60_000 : 60_000;
const EXTENDED_PREMATCH_FAR_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === "5dollarfootballapi" ? 15 * 60_000 : 5 * 60_000;
const EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE = Math.max(
  1,
  Number(process.env.ODDS_API_EXTENDED_MAX_MATCHES_PER_CYCLE || 500),
);
const LIVE_RESULT_INTERVAL_MS = 10_000;
const API_FOOTBALL_LIVE_INTERVAL_MS = 30_000;
const API_FOOTBALL_MAX_DETAIL_MATCHES_PER_CYCLE = 1;

if (WORKER_MODE !== 'live') {
createWorker({
  queue: 'odds',
  handlers,
  tickIntervalMs: 5_000,
  pollIntervalMs: 2_000,
  batchSize: 10,
  async tick(ctx) {
      console.log("ODDS_TICK_START", JSON.stringify({
        sportsProviderEnabled: env.sportsProviderEnabled,
        provider: ctx.services.providers.sports.name,
        providerConfigured: ctx.services.providers.sports.configured,
      }));
    await ctx.withLock('odds:tick', 180, async () => {
        console.log("ODDS_TICK_LOCK_CALLBACK_ENTERED");
      if (!env.sportsProviderEnabled) {
        // No provider: nothing to ingest. Record the state once per tick, never fake odds.
        await recordProviderStatus(ctx, 'disabled', 'No sports provider configured');
        return;
      }
        const now = Date.now();
        const includeLive = now - lastLiveOddsAt >= LIVE_ODDS_INTERVAL_MS;
        const includeExtendedLive =
          now - lastExtendedLiveOddsAt >= EXTENDED_LIVE_ODDS_INTERVAL_MS;
        const includeExtendedPrematchNear =
          now - lastExtendedPrematchNearOddsAt >= EXTENDED_PREMATCH_NEAR_ODDS_INTERVAL_MS;
        const includeExtendedPrematchFar =
          now - lastExtendedPrematchFarOddsAt >= EXTENDED_PREMATCH_FAR_ODDS_INTERVAL_MS;

        if (includeLive) lastLiveOddsAt = now;
        if (includeExtendedLive) lastExtendedLiveOddsAt = now;
        if (includeExtendedPrematchNear) lastExtendedPrematchNearOddsAt = now;
        if (includeExtendedPrematchFar) lastExtendedPrematchFarOddsAt = now;

        const includePrematchNear = now - lastPrematchNearOddsAt >= PREMATCH_NEAR_ODDS_INTERVAL_MS;
        const includePrematchMid = now - lastPrematchMidOddsAt >= PREMATCH_MID_ODDS_INTERVAL_MS;
        const includePrematchFar = now - lastPrematchFarOddsAt >= PREMATCH_FAR_ODDS_INTERVAL_MS;

        if (includePrematchNear) lastPrematchNearOddsAt = now;
        if (includePrematchMid) lastPrematchMidOddsAt = now;
        if (includePrematchFar) lastPrematchFarOddsAt = now;

        const includePrematch = includePrematchNear || includePrematchMid || includePrematchFar;

        if (includeLive) {
          console.log("ODDS_LIVE_PRIORITY", JSON.stringify({
            at: new Date(now).toISOString(),
            intervalMs: LIVE_ODDS_INTERVAL_MS,
          }));
          await runDedicatedLiveTick(ctx);
        }

        const configuredPrematchProviders = (
          ctx.services.providers.sportsProviders?.length
            ? ctx.services.providers.sportsProviders
            : [ctx.services.providers.sports]
        ).filter((provider, index, all) =>
          provider.configured &&
          all.findIndex((item) => item.name === provider.name) === index
        );

        for (const sourceProvider of configuredPrematchProviders) {
        const pending = includePrematch
          ? await ctx.services.db.query<{
              match_id: string;
              provider_id: string | null;
              status: string;
              scheduled_at: string;
            }>(
              `with scheduled_matches as (
                 select
                   m.id as match_id,
                   m.provider_id,
                   m.status::text as status,
                   m.scheduled_at,
                   case
                     when m.scheduled_at <= now() + interval '30 minutes' then 0
                     when m.scheduled_at <= now() + interval '24 hours' then 1
                     else 2
                   end as bucket_order,
                   (
                     select max(sl.odds_updated_at)
                     from nova.markets mk
                     join nova.selections sl on sl.market_id = mk.id
                     where mk.match_id = m.id
                   ) as newest_odds_updated_at,
                   case
                     when not exists (
                       select 1
                       from nova.markets mk
                       where mk.match_id = m.id
                     ) then 0
                     when not exists (
                       select 1
                       from nova.selections sl
                       where sl.match_id = m.id
                         and sl.odds_scaled > 0
                     ) then 1
                     else 2
                   end as data_priority
                 from nova.matches m
                 where m.provider = $4
                   and m.provider_id is not null
                   and m.status::text = 'scheduled'
                   and (
                     ($1::boolean and m.scheduled_at <= now() + interval '30 minutes')
                     or ($2::boolean and m.scheduled_at > now() + interval '30 minutes' and m.scheduled_at <= now() + interval '24 hours')
                     or ($3::boolean and m.scheduled_at > now() + interval '24 hours')
                   )
               ),
               ranked as (
                 select
                   sm.*,
                   row_number() over (
                     partition by sm.bucket_order
                     order by
                       sm.data_priority asc,
                       sm.newest_odds_updated_at asc nulls first,
                       sm.scheduled_at asc,
                       sm.match_id asc
                   ) as bucket_rank
                 from scheduled_matches sm
               )
               select
                 match_id,
                 provider_id,
                 status,
                 scheduled_at
               from ranked
               where
                 (bucket_order = 0 and $1::boolean and bucket_rank <= 200)
                 or (bucket_order = 1 and $2::boolean and bucket_rank <= 200)
                 or (bucket_order = 2 and $3::boolean and bucket_rank <= 500)
               order by
                 bucket_order asc,
                 bucket_rank asc`,
              [
                includePrematchNear,
                includePrematchMid,
                includePrematchFar,
                sourceProvider.name,
              ]
            ).catch(() => [])
          : [];

        const extendedPending =
          includeExtendedPrematchNear || includeExtendedPrematchFar
            ? await ctx.services.db.query<{
                match_id: string;
                provider_id: string | null;
                status: string;
                scheduled_at: string;
              }>(
                `select
                   m.id as match_id,
                   m.provider_id,
                   m.status::text as status,
                   m.scheduled_at
                 from nova.matches m
                 where m.provider = $2
                   and m.status::text = 'scheduled'
                   and m.provider_id is not null
                   and m.scheduled_at > now() + interval '30 minutes'
                 order by
                   (
                     select max(sl.odds_updated_at)
                     from nova.markets mk
                     join nova.selections sl on sl.market_id = mk.id
                     where mk.match_id = m.id
                   ) asc nulls first,
                   m.scheduled_at asc,
                   m.id asc
                 limit $1`,
                [
                  EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE,
                  sourceProvider.name,
                ],
              ).catch(() => [])
            : [];

        const providerIds = pending
          .filter((row) =>
            row.status === 'scheduled'
              ? includePrematch
              : false
          )
          .map((row) => row.provider_id)
          .filter((id): id is string => Boolean(id));

        const extendedNearProviderIds = includeExtendedPrematchNear
          ? extendedPending
              .filter((row) => {
                if (row.status !== 'scheduled' || !row.provider_id) return false;
                const scheduledAt = new Date(row.scheduled_at).getTime();
                return scheduledAt > now && scheduledAt <= now + 30 * 60_000;
              })
              .slice(0, EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE)
              .map((row) => row.provider_id)
              .filter((id): id is string => Boolean(id))
          : [];

        const extendedFarProviderIds = includeExtendedPrematchFar
          ? extendedPending
              .filter((row) => {
                if (row.status !== 'scheduled' || !row.provider_id) return false;
                const scheduledAt = new Date(row.scheduled_at).getTime();
                return scheduledAt > now + 30 * 60_000;
              })
              .slice(0, EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE)
              .map((row) => row.provider_id)
              .filter((id): id is string => Boolean(id))
          : [];

        const extendedProviderIds = [
          ...new Set([...extendedNearProviderIds, ...extendedFarProviderIds]),
        ].slice(0, EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE);

        console.log("ODDS_PREMATCH_FETCH_START", JSON.stringify({
          at: new Date(now).toISOString(),
          requestedMatches: providerIds.length,
          includePrematch,
        }));

        const batchedOdds =
          providerIds.length > 0
            ? await sourceProvider.fetchOdds(providerIds)
            : { ok: true, value: [] };

        console.log(
          "ODDS_BATCH_RESULT",
          JSON.stringify({
            requestedMatches: providerIds.length,
            ok: batchedOdds.ok,
            bundles: batchedOdds.value?.length ?? 0,
            errorMessage: batchedOdds.errorMessage ?? null,
          }),
        );

        if (extendedProviderIds.length > 0) {
          void runExtendedPrematchOddsDetached(
            ctx,
            extendedPending,
            extendedProviderIds,
            sourceProvider,
          );
        }

        const requestedNormalProviderIds = new Set(providerIds);
        const bundlesByProviderId = new Map<
          string,
          import("@/lib/ports/providers").ProviderOddsBundle
        >();

        for (const bundle of batchedOdds.value ?? []) {
          if (!requestedNormalProviderIds.has(bundle.matchProviderId)) {
            console.warn("ODDS_NORMAL_PROVIDER_MATCH_ID_MISMATCH", JSON.stringify({
              provider: sourceProvider.name,
              receivedProviderId: bundle.matchProviderId,
            }));
            continue;
          }
          bundlesByProviderId.set(bundle.matchProviderId, bundle);
        }

        const extendedProviderIdSet = new Set(extendedProviderIds);

        const normalSyncPending = pending.filter((row) => {
          if (!row.provider_id) return false;

          if (extendedProviderIdSet.has(row.provider_id)) {
            console.log("ODDS_NORMAL_SYNC_SKIPPED_EXTENDED", JSON.stringify({
              matchId: row.match_id,
              providerId: row.provider_id,
            }));
            return false;
          }

          return true;
        });

        const SYNC_CONCURRENCY = 12;

        for (let i = 0; i < normalSyncPending.length; i += SYNC_CONCURRENCY) {
          const batch = normalSyncPending.slice(i, i + SYNC_CONCURRENCY);

          await Promise.allSettled(
            batch.map(async (row) => {
              if (!row.provider_id) return;

              const bundle = bundlesByProviderId.get(row.provider_id);
              if (!bundle) return;

              const syncStartedAt = Date.now();

              console.log("ODDS_SYNC_START", JSON.stringify({
                matchId: row.match_id,
                source: "normal",
              }));

              try {
                const result = await syncOdds(
                  ctx,
                  row.match_id,
                  { ok: true, value: [bundle] },
                );

                console.log("ODDS_SYNC_DONE", JSON.stringify({
                  matchId: row.match_id,
                  source: "normal",
                  ms: Date.now() - syncStartedAt,
                  ...result,
                }));
              } catch (error) {
                console.error("ODDS_SYNC_FAILED", JSON.stringify({
                  matchId: row.match_id,
                  source: "normal",
                  error: error instanceof Error ? error.message : String(error),
                }));
              }
            }),
          );
        }

        console.log("ODDS_CORE_TICK_DONE", JSON.stringify({
          at: new Date().toISOString(),
          requestedMatches: providerIds.length,
          bundles: bundlesByProviderId.size,
        }));

        }

        void runLiveStateMaintenanceDetached(ctx, now);
        void runOddsMaintenanceDetached(ctx, now);

    });
  },
});
}


const extendedPrematchRunning = new Set<string>();

async function runExtendedPrematchOddsDetached(
  ctx: WorkerContext,
  pending: Array<{
    match_id: string;
    provider_id: string | null;
    status: string;
  }>,
  providerIds: string[],
  sourceProvider: import("@/lib/ports/providers").SportsDataProvider,
): Promise<void> {
  const providerKey = sourceProvider.name;
  if (extendedPrematchRunning.has(providerKey)) {
    console.log("ODDS_EXTENDED_PREMATCH_SKIPPED", JSON.stringify({
      reason: "already_running",
      requestedMatches: providerIds.length,
    }));
    return;
  }

  extendedPrematchRunning.add(providerKey);

  try {
    console.log("ODDS_EXTENDED_PREMATCH_DETACHED_START", JSON.stringify({
      at: new Date().toISOString(),
      provider: providerKey,
      requestedMatches: providerIds.length,
    }));

    await ctx.withLock(`odds:extended-prematch:${providerKey}`, 900, async () => {
      const startedAt = Date.now();

      const result = await sourceProvider.fetchEventOdds(providerIds);

      console.log("ODDS_EVENT_BATCH_RESULT", JSON.stringify({
        requestedMatches: providerIds.length,
        ok: result.ok,
        bundles: result.value?.length ?? 0,
        errorMessage: result.errorMessage ?? null,
        ms: Date.now() - startedAt,
      }));

      if (!result.ok || !result.value || result.value.length === 0) {
        return;
      }

      const requestedProviderIds = new Set(providerIds);
      const bundlesByProviderId = new Map<
        string,
        import("@/lib/ports/providers").ProviderOddsBundle
      >();

      for (const bundle of result.value) {
        if (!requestedProviderIds.has(bundle.matchProviderId)) {
          console.warn("ODDS_EXTENDED_PROVIDER_MATCH_ID_MISMATCH", JSON.stringify({
            provider: providerKey,
            receivedProviderId: bundle.matchProviderId,
          }));
          continue;
        }
        bundlesByProviderId.set(bundle.matchProviderId, bundle);
      }

      const targets = pending.filter(
        (row) => row.provider_id && requestedProviderIds.has(row.provider_id)
          && bundlesByProviderId.has(row.provider_id),
      );

      const SYNC_CONCURRENCY = 12;

      for (let i = 0; i < targets.length; i += SYNC_CONCURRENCY) {
        const batch = targets.slice(i, i + SYNC_CONCURRENCY);

        await Promise.allSettled(
          batch.map(async (row) => {
            if (!row.provider_id) return;

            const bundle = bundlesByProviderId.get(row.provider_id);
            if (!bundle) return;

            const syncStartedAt = Date.now();

            try {
              const syncResult = await syncOdds(
                ctx,
                row.match_id,
                { ok: true, value: [bundle] },
              );

              console.log("ODDS_EXTENDED_SYNC_DONE", JSON.stringify({
                matchId: row.match_id,
                ms: Date.now() - syncStartedAt,
                ...syncResult,
              }));
            } catch (error) {
              console.error("ODDS_EXTENDED_SYNC_FAILED", JSON.stringify({
                matchId: row.match_id,
                error: error instanceof Error ? error.message : String(error),
              }));
            }
          }),
        );
      }

      console.log("ODDS_EXTENDED_PREMATCH_DETACHED_DONE", JSON.stringify({
        requestedMatches: providerIds.length,
        bundles: result.value.length,
        syncedTargets: targets.length,
        ms: Date.now() - startedAt,
      }));
    });
  } catch (error) {
    console.error("ODDS_EXTENDED_PREMATCH_DETACHED_FAILED", JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }));
  } finally {
    extendedPrematchRunning.delete(providerKey);
  }
}


let maintenanceRunning = false;

let liveStateMaintenanceRunning = false;

async function runLiveStateMaintenanceDetached(
  ctx: WorkerContext,
  scheduledAt: number,
): Promise<void> {
  if (liveStateMaintenanceRunning) {
    console.log("ODDS_LIVE_STATE_SKIPPED", JSON.stringify({
      reason: "already_running",
    }));
    return;
  }

  const now = Date.now();
  const sportsDue =
    now - lastResultReconciliationAt >= LIVE_RESULT_INTERVAL_MS;
  const apiFootballDue =
    ctx.services.providers.live.configured &&
    now - lastApiFootballLiveSyncAt >= API_FOOTBALL_LIVE_INTERVAL_MS;

  if (!sportsDue && !apiFootballDue) {
    return;
  }

  liveStateMaintenanceRunning = true;

  try {
    console.log("ODDS_LIVE_STATE_START", JSON.stringify({
      at: new Date(now).toISOString(),
      scheduledAt,
      sportsDue,
      apiFootballDue,
    }));

    await ctx.withLock("odds:live-state", 60, async () => {
      const liveStartedAt = Date.now();

      if (
        ctx.services.providers.live.configured &&
        Date.now() - lastApiFootballLiveSyncAt >=
          API_FOOTBALL_LIVE_INTERVAL_MS
      ) {
        lastApiFootballLiveSyncAt = Date.now();

        try {
          const liveDataResult = await syncApiFootballLiveData(ctx);
          console.log(
            "API_FOOTBALL_LIVE_SYNC",
            JSON.stringify(liveDataResult),
          );
        } catch (error) {
          console.error(
            "API_FOOTBALL_LIVE_SYNC_FAILED",
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      if (
        Date.now() - lastResultReconciliationAt >=
        LIVE_RESULT_INTERVAL_MS
      ) {
        if (Date.now() - lastResultsQuotaErrorAt < 30_000) {
          console.log(
            "ODDS_RESULT_RECONCILIATION_SKIPPED",
            JSON.stringify({
              reason: "provider_quota_exhausted",
              nextInMs: Math.max(
                0,
                30_000 - (Date.now() - lastResultsQuotaErrorAt),
              ),
            }),
          );
        } else {
          lastResultReconciliationAt = Date.now();

          try {
            const resultReconciliation =
              await reconcileLiveResults(ctx);

            console.log(
              "ODDS_RESULT_RECONCILIATION",
              JSON.stringify(resultReconciliation),
            );
          } catch (error) {
            console.error(
              "ODDS_RESULT_RECONCILIATION_FAILED",
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
        }
      }

      console.log("ODDS_LIVE_STATE_DONE", JSON.stringify({
        at: new Date().toISOString(),
        ms: Date.now() - liveStartedAt,
      }));
    });
  } catch (error) {
    console.error(
      "ODDS_LIVE_STATE_FAILED",
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  } finally {
    liveStateMaintenanceRunning = false;
  }
}

async function runOddsMaintenanceDetached(
  ctx: WorkerContext,
  scheduledAt: number,
): Promise<void> {
  if (maintenanceRunning) {
    console.log("ODDS_MAINTENANCE_SKIPPED", JSON.stringify({
      reason: "already_running",
    }));
    return;
  }

  maintenanceRunning = true;

  try {
    console.log("ODDS_MAINTENANCE_DETACHED_START", JSON.stringify({
      at: new Date().toISOString(),
      scheduledAt,
    }));

    await ctx.withLock("odds:maintenance", 900, async () => {
      const maintenanceNow = Date.now();

      if (maintenanceNow - lastMatchDiscoveryAt >= MATCH_DISCOVERY_INTERVAL_MS) {
        console.log("ODDS_TICK_AFTER_ODDS_BEFORE_SYNC_MATCHES");

        const configuredProviders = (
          ctx.services.providers.sportsProviders?.length
            ? ctx.services.providers.sportsProviders
            : [ctx.services.providers.sports]
        ).filter((provider, index, all) =>
          provider.configured &&
          all.findIndex((item) => item.name === provider.name) === index
        );

        let totalSynced = 0;
        for (const sourceProvider of configuredProviders) {
          try {
            const result = await syncMatches(ctx, undefined, sourceProvider);
            totalSynced += result.synced;
            console.log("ODDS_TICK_AFTER_SYNC_MATCHES", JSON.stringify({
              provider: sourceProvider.name,
              ...result,
            }));
          } catch (error) {
            console.error("ODDS_MATCH_DISCOVERY_PROVIDER_FAILED", JSON.stringify({
              provider: sourceProvider.name,
              error: error instanceof Error ? error.message : String(error),
            }));
          }
        }

        if (configuredProviders.length > 0) {
          lastMatchDiscoveryAt = Date.now();
        }
        console.log("ODDS_MATCH_DISCOVERY_MULTI_PROVIDER_DONE", JSON.stringify({
          providers: configuredProviders.map((provider) => provider.name),
          totalSynced,
        }));
      } else {
        console.log("ODDS_MATCH_DISCOVERY_SKIPPED", JSON.stringify({
          nextInMs: Math.max(
            0,
            MATCH_DISCOVERY_INTERVAL_MS -
              (maintenanceNow - lastMatchDiscoveryAt),
          ),
        }));
      }

      console.log("ODDS_MAINTENANCE_DETACHED_DONE", JSON.stringify({
        at: new Date().toISOString(),
        ms: Date.now() - maintenanceNow,
      }));
    });
  } catch (error) {
    console.error(
      "ODDS_MAINTENANCE_DETACHED_FAILED",
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
    );
  } finally {
    maintenanceRunning = false;
  }
}

const LIVE_DISCOVERY_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.ODDS_LIVE_DISCOVERY_INTERVAL_MS ?? 60_000) || 60_000,
);
let lastLiveDiscoveryAt = 0;


async function syncFiveDollarLiveDetails(
  ctx: WorkerContext,
  liveMatches: Array<{
    providerId: string;
    homeTeamName: string;
    awayTeamName: string;
    minute: number | null;
    period: string | null;
    homeScore: number | null;
    awayScore: number | null;
    liveEvents?: unknown[];
    liveStats?: unknown;
  }>,
): Promise<void> {
  const providerName = "5dollarfootballapi";
  if (!ctx.services.providers.sportsProviders?.some((provider) => provider.name === providerName)) return;

  const providerIds = liveMatches.map((m) => m.providerId).filter(Boolean);
  if (!providerIds.length) return;

  const placeholders = providerIds.map((_, index) => `$${index + 2}`).join(", ");
  const rows = await ctx.services.db.query<{
    match_id: string;
    provider_id: string;
    home_team_id: string | null;
    away_team_id: string | null;
  }>(
    `select id as match_id, provider_id, home_team_id, away_team_id
       from nova.matches
      where provider = $1
        and provider_id in (${placeholders})`,
    [providerName, ...providerIds],
  );

  const matchByProvider = new Map(rows.map((row) => [row.provider_id, row]));

  for (const fixture of liveMatches) {
    const matchRow = matchByProvider.get(fixture.providerId);
    if (!matchRow) continue;
    const matchId = matchRow.match_id;

    const observedAt = new Date().toISOString();

    await ctx.services.db.query(
      `update nova.matches
          set status = 'live'::nova.match_status,
              home_score = coalesce($2, home_score),
              away_score = coalesce($3, away_score),
              minute = coalesce($4, minute),
              period = coalesce($5, period),
              provider_updated_at = now(),
              updated_at = now()
        where id = $1`,
      [
        matchId,
        fixture.homeScore,
        fixture.awayScore,
        fixture.minute,
        fixture.period,
      ],
    );

    const rawStats = fixture.liveStats && typeof fixture.liveStats === "object"
      ? fixture.liveStats as Record<string, unknown>
      : {};
    const homeStats: Record<string, unknown> = {};
    const awayStats: Record<string, unknown> = {};
    for (const key of ["attacks", "dangerous_attacks", "shots_on_target", "shots_off_target", "possession"]) {
      const category = rawStats[key];
      if (category && typeof category === "object") {
        const values = category as Record<string, unknown>;
        homeStats[key] = values["home"];
        awayStats[key] = values["away"];
      }
    }
    const statKeys: Array<[string, string]> = [
      ["attacks", "Attacks"],
      ["dangerous_attacks", "Dangerous attacks"],
      ["shots_on_target", "Shots on target"],
      ["shots_off_target", "Shots off target"],
      ["possession", "Possession"],
    ];

    const buildTeamStats = (
      teamName: string,
      side: Record<string, unknown>,
      fallbackSide: "home" | "away",
    ) => [
      ...statKeys.map(([key, label]) => ({
        type: label,
        value: side[key] == null ? null : String(side[key]),
      })),
      {
        type: "Corners",
        value: rawStats["corners"] && typeof rawStats["corners"] === "object"
          ? String(((rawStats["corners"] as Record<string, unknown>)[fallbackSide]) ?? "")
          : null,
      },
      {
        type: "Yellow cards",
        value: rawStats["cards"] && typeof rawStats["cards"] === "object"
          ? String((((rawStats["cards"] as Record<string, unknown>)[fallbackSide]) as Record<string, unknown> | undefined)?.["yellow"] ?? "")
          : null,
      },
      {
        type: "Red cards",
        value: rawStats["cards"] && typeof rawStats["cards"] === "object"
          ? String((((rawStats["cards"] as Record<string, unknown>)[fallbackSide]) as Record<string, unknown> | undefined)?.["red"] ?? "")
          : null,
      },
    ];

    const statistics = {
      fixtureId: fixture.providerId,
      teams: [
        {
          providerTeamId: null,
          teamName: fixture.homeTeamName,
          statistics: buildTeamStats(fixture.homeTeamName, homeStats, "home"),
        },
        {
          providerTeamId: null,
          teamName: fixture.awayTeamName,
          statistics: buildTeamStats(fixture.awayTeamName, awayStats, "away"),
        },
      ],
      observedAt,
    };


    const events = Array.isArray(fixture.liveEvents) ? fixture.liveEvents : [];
    for (const event of events) {
      if (!event || typeof event !== "object") continue;
      const e = event as Record<string, unknown>;
      const rawTeam = e["team"] ?? e["team_side"] ?? e["teamSide"] ?? e["team_name"] ?? e["teamName"];
      const rawTeamRecord = rawTeam && typeof rawTeam === "object" && !Array.isArray(rawTeam)
        ? rawTeam as Record<string, unknown>
        : null;
      const rawTeamText = typeof rawTeam === "string" || typeof rawTeam === "number"
        ? String(rawTeam).trim()
        : String(rawTeamRecord?.["name"] ?? rawTeamRecord?.["team_name"] ?? rawTeamRecord?.["teamName"] ?? e["team_name"] ?? e["teamName"] ?? "").trim();
      const explicitSide = String(rawTeamRecord?.["side"] ?? rawTeamRecord?.["position"] ?? e["team_side"] ?? e["teamSide"] ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
      const normalizedRawTeam = normalizeLiveTeamName(rawTeamText);
      const normalizedHomeTeam = normalizeLiveTeamName(fixture.homeTeamName);
      const normalizedAwayTeam = normalizeLiveTeamName(fixture.awayTeamName);
      const rawTeamSide = rawTeamText.toLowerCase().replace(/[_-]+/g, " ").trim();
      const homeNameMatches = normalizedRawTeam.length >= 3 && normalizedHomeTeam.length >= 3 &&
        (normalizedRawTeam === normalizedHomeTeam || normalizedHomeTeam.includes(normalizedRawTeam) || normalizedRawTeam.includes(normalizedHomeTeam));
      const awayNameMatches = normalizedRawTeam.length >= 3 && normalizedAwayTeam.length >= 3 &&
        (normalizedRawTeam === normalizedAwayTeam || normalizedAwayTeam.includes(normalizedRawTeam) || normalizedRawTeam.includes(normalizedAwayTeam));
      const teamSide: "home" | "away" | null =
        ["home", "home team", "h"].includes(explicitSide) || ["home", "home team", "h"].includes(rawTeamSide) || homeNameMatches
          ? "home"
          : ["away", "away team", "a"].includes(explicitSide) || ["away", "away team", "a"].includes(rawTeamSide) || awayNameMatches
            ? "away"
            : null;
      const teamId = teamSide === "home"
        ? matchRow.home_team_id
        : teamSide === "away"
          ? matchRow.away_team_id
          : null;
      const rawMinute = e["minute"];
      const parsedMinute = rawMinute == null || rawMinute === "" ? NaN : Number(rawMinute);
      const minute = Number.isFinite(parsedMinute) ? parsedMinute : null;
      const type = String(e["type"] ?? "event").trim().toLowerCase();
      const normalizedType = type.replace(/[\s_-]+/g, "");
      const isSubstitution = normalizedType.includes("subst") || normalizedType.includes("substitution");
      const period = e["period"] == null ? null : String(e["period"]);
      const readPlayerName = (value: unknown): string | null => {
        if (typeof value === "string" || typeof value === "number") {
          const text = String(value).trim();
          return text || null;
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) return null;
        const record = value as Record<string, unknown>;
        for (const key of ["name", "full_name", "fullname", "player_name", "playerName", "common_name"]) {
          const candidate = record[key];
          if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
        }
        const first = typeof record["first_name"] === "string" ? record["first_name"].trim() : "";
        const last = typeof record["last_name"] === "string" ? record["last_name"].trim() : "";
        return [first, last].filter(Boolean).join(" ") || null;
      };
      const directPlayerName = readPlayerName(e["player_name"] ?? e["playerName"] ?? e["player"]);
      const playerIn = readPlayerName(e["player_in"] ?? e["playerIn"] ?? e["incoming_player"]);
      const playerOut = readPlayerName(e["player_out"] ?? e["playerOut"] ?? e["outgoing_player"]);
      const playerName = isSubstitution ? null : directPlayerName ?? playerIn;
      const rawDetail = e["detail"] ?? e["description"] ?? e["comments"];
      const detailCandidate = typeof rawDetail === "string" || typeof rawDetail === "number"
        ? String(rawDetail).trim()
        : null;
      const isCountOnlyEvent = detailCandidate != null &&
        /^count\s*:\s*\d+(?:\.\d+)?$/i.test(detailCandidate);
      if (isCountOnlyEvent) continue;
      const detailText = detailCandidate || null;
      const details = [
        detailText || null,
        isSubstitution && playerIn ? `In: ${playerIn}` : null,
        isSubstitution && playerOut ? `Out: ${playerOut}` : null,
        isSubstitution && !playerIn && !playerOut && directPlayerName ? `Player: ${directPlayerName}` : null,
        !isSubstitution && playerOut ? `Out: ${playerOut}` : null,
      ].filter(Boolean);
      const providerEventIdValue = e["id"] ?? e["event_id"] ?? e["provider_event_id"];
      const stableIdentity = providerEventIdValue != null
        ? String(providerEventIdValue)
        : `${type}:${minute ?? "na"}:${teamSide ?? "unknown"}:${playerName ?? playerIn ?? directPlayerName ?? ""}:${playerOut ?? ""}:${String(e["count"] ?? "")}`;
      const providerEventId = `5dollar:${fixture.providerId}:${stableIdentity}`;

      await ctx.services.db.query(
        `insert into nova.match_events
          (match_id, provider_event_id, type, minute, period, team_id, player_name, detail, occurred_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, now())
         on conflict (match_id, provider_event_id) where provider_event_id is not null
         do update set
           type = excluded.type,
           minute = excluded.minute,
           period = excluded.period,
           team_id = coalesce(excluded.team_id, nova.match_events.team_id),
           player_name = coalesce(excluded.player_name, nova.match_events.player_name),
           detail = excluded.detail`,
        [
          matchId,
          providerEventId,
          type,
          minute,
          period,
          teamId,
          playerName,
          details.join(" · ") || null,
          observedAt,
        ],
      );
    }
    await ctx.services.db.query(
      `insert into nova.match_stats (match_id, payload, provider, updated_at)
       values ($1, $2::jsonb, $3, now())
       on conflict (match_id) do update
       set payload = excluded.payload,
           provider = excluded.provider,
           updated_at = now()`,
      [
        matchId,
        JSON.stringify({
          source: "5dollarfootballapi",
          fixtureId: fixture.providerId,
          minute: fixture.minute,
          period: fixture.period,
          liveHomeScore: fixture.homeScore,
          liveAwayScore: fixture.awayScore,
          statistics,
          observedAt,
        }),
        "5dollarfootballapi",
      ],
    );
    console.log("FIVEDOLLAR_LIVE_DETAILS_SAVED", JSON.stringify({
      providerId: fixture.providerId,
      matchId,
      events: events.length,
    }));
  }
}

async function runDedicatedLiveDiscovery(ctx: WorkerContext): Promise<void> {
  const now = Date.now();
  if (now - lastLiveDiscoveryAt < LIVE_DISCOVERY_INTERVAL_MS) return;
  lastLiveDiscoveryAt = now;

  const providers = (
    ctx.services.providers.sportsProviders?.length
      ? ctx.services.providers.sportsProviders
      : [ctx.services.providers.sports]
  ).filter((provider, index, all) =>
    provider.configured &&
    all.findIndex((item) => item.name === provider.name) === index
  );

  console.log("ODDS_LIVE_DISCOVERY_START", JSON.stringify({
    at: new Date(now).toISOString(),
    providers: providers.map((provider) => provider.name),
    intervalMs: LIVE_DISCOVERY_INTERVAL_MS,
  }));

  for (const sourceProvider of providers) {
    try {
      const result = await sourceProvider.fetchLiveMatches();
      console.log("ODDS_LIVE_DISCOVERY_PROVIDER_RESULT", JSON.stringify({
        provider: sourceProvider.name,
        ok: result.ok,
        matches: result.value?.length ?? 0,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
      }));
      if (!result.ok || !result.value) continue;

      const liveMatches = result.value.filter((match) => match.status === "live");
      if (liveMatches.length === 0) continue;

      const providerIds = [...new Set(liveMatches.map((match) => match.providerId).filter(Boolean))];
      if (providerIds.length === 0) continue;

      const placeholders = providerIds.map((_, index) => `$${index + 2}`).join(", ");
      const existing = await ctx.services.db.query<{ provider_id: string | null }>(
        `select provider_id
           from nova.matches
          where provider = $1
            and provider_id in (${placeholders})`,
        [sourceProvider.name, ...providerIds],
      );

      const existingIds = new Set(
        existing.map((row) => row.provider_id).filter((id): id is string => Boolean(id)),
      );
      const newLiveMatches = liveMatches.filter((match) => !existingIds.has(match.providerId));

      console.log("ODDS_LIVE_DISCOVERY_SUMMARY", JSON.stringify({
        provider: sourceProvider.name,
        discovered: liveMatches.length,
        alreadyKnown: liveMatches.length - newLiveMatches.length,
        newMatches: newLiveMatches.length,
      }));

      if (newLiveMatches.length > 0) {
        const syncResult = await syncMatches(
          ctx,
          { ok: true, value: newLiveMatches },
          sourceProvider,
        );
        console.log("ODDS_LIVE_DISCOVERY_SYNC_MATCHES_DONE", JSON.stringify({
          provider: sourceProvider.name,
          ...syncResult,
        }));
      }

      if (sourceProvider.name === "5dollarfootballapi") {
        await syncFiveDollarLiveDetails(
          ctx,
          liveMatches as Array<{
            providerId: string;
            homeTeamName: string;
            awayTeamName: string;
            minute: number | null;
            period: string | null;
            homeScore: number | null;
            awayScore: number | null;
            liveEvents?: unknown[];
            liveStats?: unknown;
          }>,
        );
      }
    } catch (error) {
      console.error("ODDS_LIVE_DISCOVERY_FAILED", JSON.stringify({
        provider: sourceProvider.name,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
}

async function runDedicatedLiveTick(ctx: WorkerContext): Promise<void> {
  if (!env.sportsProviderEnabled) return;

  void runDedicatedLiveDiscovery(ctx);

  const providers = (
    ctx.services.providers.sportsProviders?.length
      ? ctx.services.providers.sportsProviders
      : [ctx.services.providers.sports]
  ).filter((provider, index, all) =>
    provider.configured &&
    all.findIndex((item) => item.name === provider.name) === index
  );

  await ctx.withLock("odds:live-priority", 15, async () => {
    for (const sourceProvider of providers) {
      try {
        const pending = await ctx.services.db.query<{
          match_id: string;
          provider_id: string | null;
        }>(
          `select m.id as match_id, m.provider_id
             from nova.matches m
            where m.provider = $1
              and m.provider_id is not null
              and m.status::text in ('live','in_play','halftime','break')
            order by
              (select max(sl.odds_updated_at)
                 from nova.markets mk
                 join nova.selections sl on sl.market_id = mk.id
                where mk.match_id = m.id) asc nulls first,
              m.scheduled_at asc
            limit 200`,
          [sourceProvider.name],
        );

        const providerIds = pending
          .map((row) => row.provider_id)
          .filter((id): id is string => Boolean(id));

        console.log("ODDS_LIVE_WORKER_FETCH_START", JSON.stringify({
          at: new Date().toISOString(),
          provider: sourceProvider.name,
          requestedMatches: providerIds.length,
          intervalMs: LIVE_ODDS_INTERVAL_MS,
        }));

        if (providerIds.length === 0) continue;

        const result = await sourceProvider.fetchOdds(providerIds);
        console.log("ODDS_LIVE_WORKER_PROVIDER_RESULT", JSON.stringify({
          provider: sourceProvider.name,
          requestedMatches: providerIds.length,
          ok: result.ok,
          bundles: result.value?.length ?? 0,
          errorCode: result.errorCode ?? null,
          errorMessage: result.errorMessage ?? null,
        }));

        if (!result.ok || !result.value) continue;

        const requestedIds = new Set(providerIds);
        const bundlesByProviderId = new Map(
          result.value
            .filter((bundle) => requestedIds.has(bundle.matchProviderId))
            .map((bundle) => [bundle.matchProviderId, bundle]),
        );

        const concurrency = 12;
        for (let i = 0; i < pending.length; i += concurrency) {
          await Promise.allSettled(
            pending.slice(i, i + concurrency).map(async (row) => {
              if (!row.provider_id) return;
              const bundle = bundlesByProviderId.get(row.provider_id);
              if (!bundle) return;

              try {
                const syncResult = await syncOdds(ctx, row.match_id, {
                  ok: true,
                  value: [bundle],
                });
                console.log("ODDS_LIVE_WORKER_SYNC_DONE", JSON.stringify({
                  provider: sourceProvider.name,
                  matchId: row.match_id,
                  ...syncResult,
                }));
              } catch (error) {
                console.error("ODDS_LIVE_WORKER_SYNC_FAILED", JSON.stringify({
                  provider: sourceProvider.name,
                  matchId: row.match_id,
                  error: error instanceof Error ? error.message : String(error),
                }));
              }
            }),
          );
        }
      } catch (error) {
        console.error("ODDS_LIVE_WORKER_PROVIDER_FAILED", JSON.stringify({
          provider: sourceProvider.name,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  });
}

if (WORKER_MODE === 'live') {
createWorker({
  queue: 'odds-live',
  handlers: [],
  tickIntervalMs: LIVE_ODDS_INTERVAL_MS,
  pollIntervalMs: 1_000,
  batchSize: 1,
  async tick(ctx) {
    await runDedicatedLiveTick(ctx);
  },
});

}

function normalizeLiveTeamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(fc|sc|afc|cf|ac|ec|club|sporting|football|clube|futebol)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function liveTeamPairMatches(
  homeA: string,
  awayA: string,
  homeB: string,
  awayB: string,
): boolean {
  const ah = normalizeLiveTeamName(homeA);
  const aa = normalizeLiveTeamName(awayA);
  const bh = normalizeLiveTeamName(homeB);
  const ba = normalizeLiveTeamName(awayB);
  return (ah === bh && aa === ba) || (ah.includes(bh) || bh.includes(ah)) && (aa.includes(ba) || ba.includes(aa));
}

async function syncApiFootballLiveData(ctx: WorkerContext): Promise<{
  ok: boolean;
  liveFixtures: number;
  matched: number;
  eventsSaved: number;
  statsSaved: number;
  failed: number;
  errorMessage: string | null;
}> {
  const provider = ctx.services.providers.live;
  console.log("API_FOOTBALL_LIVE_FLOW", JSON.stringify({
    step: "before_fetchLiveFixtures",
    pid: process.pid,
    at: new Date().toISOString(),
  }));
  const liveResult = await provider.fetchLiveFixtures();
  console.log("API_FOOTBALL_LIVE_FLOW", JSON.stringify({
    step: "after_fetchLiveFixtures",
    pid: process.pid,
    at: new Date().toISOString(),
    ok: liveResult.ok,
    count: liveResult.value?.length ?? 0,
    error: liveResult.errorMessage ?? liveResult.errorCode ?? null,
  }));

  if (!liveResult.ok || !liveResult.value) {
    return {
      ok: false,
      liveFixtures: 0,
      matched: 0,
      eventsSaved: 0,
      statsSaved: 0,
      failed: 1,
      errorMessage: liveResult.errorMessage ?? liveResult.errorCode ?? 'API-Football live fixture request failed',
    };
  }

  const fixtures = liveResult.value;
  console.log("API_FOOTBALL_LIVE_FIXTURES_DEBUG", JSON.stringify(
    fixtures.map((f) => ({
      fixtureId: f.fixtureId,
      home: f.homeTeamName,
      away: f.awayTeamName,
      status: f.statusShort,
      minute: f.minute,
      extraMinute: f.extraMinute,
    }))
  ));
  if (fixtures.length === 0) {
    return {
      ok: true,
      liveFixtures: 0,
      matched: 0,
      eventsSaved: 0,
      statsSaved: 0,
      failed: 0,
      errorMessage: null,
    };
  }

  console.log("API_FOOTBALL_LIVE_FLOW", JSON.stringify({
    step: "before_nova_live_matches_query",
    pid: process.pid,
    at: new Date().toISOString(),
  }));
  const matches = await ctx.services.db.query<{
    match_id: string;
    home_team: string;
    away_team: string;
  }>(
    `select m.id as match_id, ht.name as home_team, at.name as away_team
       from nova.matches m
       join nova.teams ht on ht.id = m.home_team_id
       join nova.teams at on at.id = m.away_team_id
      where m.status in ('live','paused','interrupted')
      order by m.scheduled_at desc
      limit 100`,
  );

  console.log("API_FOOTBALL_LIVE_FLOW", JSON.stringify({
    step: "after_nova_live_matches_query",
    pid: process.pid,
    at: new Date().toISOString(),
    novaLiveMatches: matches.length,
  }));

  let matched = 0;
  let eventsSaved = 0;
  let statsSaved = 0;
  let failed = 0;

  for (const fixture of fixtures) {
    console.log("API_FOOTBALL_MATCH_DEBUG", JSON.stringify({
      fixtureId: fixture.fixtureId,
      apiHome: fixture.homeTeamName,
      apiAway: fixture.awayTeamName,
      matched: matches.some((row) =>
        liveTeamPairMatches(
          fixture.homeTeamName,
          fixture.awayTeamName,
          row.home_team,
          row.away_team,
        )
      ),
    }));
    const match = matches.find((row) =>
      liveTeamPairMatches(
        fixture.homeTeamName,
        fixture.awayTeamName,
        row.home_team,
        row.away_team,
      )
    );

    if (!match) continue;

    matched++;

    const snapshot = {
      source: 'api_football',
      fixtureId: fixture.fixtureId,
      status: fixture.status,
      statusShort: fixture.statusShort,
      minute: fixture.minute,
      extraMinute: fixture.extraMinute,
      period: fixture.period,
      liveHomeScore: fixture.homeScore,
      liveAwayScore: fixture.awayScore,
      homeTeamProviderId: fixture.homeTeamProviderId,
      awayTeamProviderId: fixture.awayTeamProviderId,
      observedAt: fixture.observedAt,
    };

    try {
      await ctx.services.db.query(
        `delete from nova.match_stats where match_id = $1`,
        [match.match_id],
      );

      await ctx.services.db.query(
        `insert into nova.match_stats
          (match_id, payload, provider, updated_at)
         values ($1, $2::jsonb, $3, now())`,
        [match.match_id, JSON.stringify(snapshot), 'api_football'],
      );

      statsSaved++;

      if (matched <= API_FOOTBALL_MAX_DETAIL_MATCHES_PER_CYCLE) {
        const eventsResult = await provider.fetchEvents(fixture.fixtureId);
        if (eventsResult.ok && eventsResult.value) {
          const providerName = ctx.services.providers.sports.name;
          const mappedEvents = await Promise.all(eventsResult.value.map(async (event) => {
            const mappedTeam = event.teamProviderId
              ? await ctx.services.db.queryOne<{ internal_id: string }>(
                  `select internal_id from nova.provider_entities
                    where provider = $1 and entity_type = 'team' and provider_id = $2
                    limit 1`,
                  [providerName, event.teamProviderId],
                )
              : null;
            return { event, teamId: mappedTeam?.internal_id ?? null };
          }));

          for (const { event, teamId } of mappedEvents) {
            await ctx.services.db.query(
              `insert into nova.match_events
                (match_id, provider_event_id, type, minute, period, team_id, player_name, detail, occurred_at, created_at)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, now())`,
              [
                match.match_id,
                event.providerEventId,
                event.type,
                event.minute,
                event.period,
                teamId,
                event.playerName,
                [
                  event.teamName ? `Team: ${event.teamName}` : null,
                  event.detail,
                  event.comments,
                  event.assistName ? `Assist: ${event.assistName}` : null,
                ]
                  .filter((value): value is string =>
                    typeof value === "string" &&
                    Boolean(value.trim()) &&
                    !/^count\s*:\s*\d+(?:\.\d+)?$/i.test(value.trim())
                  )
                  .join(" · ") || null,
                event.observedAt,
              ],
            );
            eventsSaved++;
          }
        } else {
          failed++;
          console.error("API_FOOTBALL_EVENTS_FAILED", JSON.stringify({
            matchId: match.match_id,
            fixtureId: fixture.fixtureId,
            error: eventsResult.errorMessage ?? eventsResult.errorCode ?? 'unknown',
          }));
        }

        const statisticsResult = await provider.fetchStatistics(fixture.fixtureId);
        if (statisticsResult.ok && statisticsResult.value) {
          await ctx.services.db.query(
            `update nova.match_stats
                set payload = payload || $2::jsonb,
                    updated_at = now()
              where match_id = $1`,
            [
              match.match_id,
              JSON.stringify({
                statistics: statisticsResult.value,
              }),
            ],
          );
          statsSaved++;
        } else {
          failed++;
          console.error("API_FOOTBALL_STATISTICS_FAILED", JSON.stringify({
            matchId: match.match_id,
            fixtureId: fixture.fixtureId,
            error: statisticsResult.errorMessage ?? statisticsResult.errorCode ?? 'unknown',
          }));
        }
      }

      console.log("API_FOOTBALL_MATCH_SYNCED", JSON.stringify({
        matchId: match.match_id,
        fixtureId: fixture.fixtureId,
        homeTeam: fixture.homeTeamName,
        awayTeam: fixture.awayTeamName,
        minute: fixture.minute,
        extraMinute: fixture.extraMinute,
        period: fixture.period,
        liveHomeScore: fixture.homeScore,
        liveAwayScore: fixture.awayScore,
      }));
    } catch (error) {
      failed++;
      console.error("API_FOOTBALL_MATCH_SYNC_FAILED", JSON.stringify({
        matchId: match.match_id,
        fixtureId: fixture.fixtureId,
        error: error instanceof Error ? error.message : String(error),
      }));
    }

    if (matched >= API_FOOTBALL_MAX_DETAIL_MATCHES_PER_CYCLE) break;
  }

  return {
    ok: true,
    liveFixtures: fixtures.length,
    matched,
    eventsSaved,
    statsSaved,
    failed,
    errorMessage: null,
  };
}

async function reconcileLiveResults(ctx: WorkerContext): Promise<{ checked: number; finished: number; liveUpdated: number; failed: number }> {
  const providers = (
    ctx.services.providers.sportsProviders?.length
      ? ctx.services.providers.sportsProviders
      : [ctx.services.providers.sports]
  ).filter((provider, index, all) =>
    provider.configured &&
    all.findIndex((item) => item.name === provider.name) === index
  );

  let checked = 0;
  let finished = 0;
  let liveUpdated = 0;
  let failed = 0;

  for (const sourceProvider of providers) {
    const rows = await ctx.services.db.query<{
      id: string;
      provider_id: string | null;
      status: string;
      home_score: number | null;
      away_score: number | null;
    }>(
      `select id, provider_id, status::text, home_score, away_score
         from nova.matches
        where provider = $1
          and provider_id is not null
          and (
            status::text in ('live','in_play','halftime','break')
            or (
              status::text = 'scheduled'
              and scheduled_at <= now() + interval '3 hours'
              and scheduled_at >= now() - interval '24 hours'
            )
          )
        order by
          case when status::text in ('live','in_play','halftime','break') then 0 else 1 end,
          scheduled_at desc
        limit 200`,
      [sourceProvider.name],
    );
    checked += rows.length;
    if (rows.length === 0) continue;

    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const requestedIds = new Set(
      rows.map((row) => row.provider_id).filter((id): id is string => Boolean(id)),
    );

    const providerResult = await sourceProvider.fetchResults(
      from,
      to,
      [...requestedIds],
    );

    console.log("ODDS_RESULTS_BATCH_RESULT", JSON.stringify({
      provider: sourceProvider.name,
      checked: rows.length,
      ok: providerResult.ok,
      snapshots: providerResult.value?.length ?? 0,
      errorCode: providerResult.errorCode ?? null,
      errorMessage: providerResult.errorMessage ?? null,
    }));

    if (!providerResult.ok || !providerResult.value) {
      const errorMessage = providerResult.errorMessage ?? providerResult.errorCode ?? "Sports result provider error";
      if (providerResult.errorCode === "OUT_OF_USAGE_CREDITS" || errorMessage.includes("OUT_OF_USAGE_CREDITS")) {
        lastResultsQuotaErrorAt = Date.now();
      }
      await recordProviderStatus(ctx, "error", errorMessage, sourceProvider.name);
      failed += rows.length;
      continue;
    }

    await recordProviderStatus(ctx, "healthy", null, sourceProvider.name);

    const resultsByProviderId = new Map<string, (typeof providerResult.value)[number]>();
    for (const result of providerResult.value) {
      if (!requestedIds.has(result.matchProviderId)) {
        console.warn("ODDS_RESULT_PROVIDER_MATCH_ID_MISMATCH", JSON.stringify({
          provider: sourceProvider.name,
          resultProviderId: result.matchProviderId,
        }));
        continue;
      }
      if (resultsByProviderId.has(result.matchProviderId)) {
        console.warn("ODDS_RESULT_DUPLICATE_SNAPSHOT", JSON.stringify({
          provider: sourceProvider.name,
          providerId: result.matchProviderId,
        }));
        continue;
      }
      resultsByProviderId.set(result.matchProviderId, result);
    }

    for (const match of rows) {
      try {
        if (!match.provider_id) continue;
        const result = resultsByProviderId.get(match.provider_id);

        // Missing snapshots are not evidence that a fixture ended or was abandoned.
        if (!result) continue;

        // Provider adapters may return live snapshots, but only explicit finished
        // results are eligible for result persistence and settlement.
        if (result.status !== "finished" && result.status !== "live") continue;
        if (
          result.status === "finished" &&
          (!result.authoritative ||
            !Number.isInteger(result.homeScore) ||
            !Number.isInteger(result.awayScore) ||
            result.homeScore! < 0 ||
            result.awayScore! < 0)
        ) {
          console.warn("ODDS_RESULT_NOT_SETTLEMENT_SAFE", JSON.stringify({
            provider: sourceProvider.name,
            matchId: match.id,
            providerId: match.provider_id,
          }));
          continue;
        }

        if (result.status === "finished") {
          const latest = await ctx.services.db.queryOne<{
            revision: number | null;
            provider: string;
            provider_result_id: string | null;
            authoritative: boolean;
            status: string;
            home_score: number | null;
            away_score: number | null;
          }>(
            `select revision, provider, provider_result_id, authoritative, status,
                    home_score, away_score
               from nova.match_results
              where match_id = $1 and authoritative = true
              order by revision desc
              limit 1`,
            [match.id],
          );

          // A result owned by another provider must never be overwritten or settled here.
          if (
            latest?.authoritative === true &&
            (latest.provider !== sourceProvider.name ||
              latest.provider_result_id !== match.provider_id)
          ) {
            console.error("ODDS_RESULT_OWNERSHIP_CONFLICT", JSON.stringify({
              matchId: match.id,
              matchProvider: sourceProvider.name,
              latestResultProvider: latest.provider,
              matchProviderId: match.provider_id,
              latestResultProviderId: latest.provider_result_id,
            }));
            failed += 1;
            continue;
          }

          // Never auto-correct an authoritative final score: it may change prior payouts.
          if (
            latest?.authoritative === true &&
            latest.provider === sourceProvider.name &&
            latest.provider_result_id === match.provider_id &&
            latest.status === "finished" &&
            (latest.home_score !== result.homeScore || latest.away_score !== result.awayScore)
          ) {
            console.error("ODDS_RESULT_CORRECTION_REQUIRES_REVIEW", JSON.stringify({
              matchId: match.id,
              provider: sourceProvider.name,
              providerResultId: match.provider_id,
              previousScore: [latest.home_score, latest.away_score],
              incomingScore: [result.homeScore, result.awayScore],
            }));
            failed += 1;
            continue;
          }
          // Idempotent retry: do not enqueue settlement again for the same finished result.
          if (
            latest?.authoritative === true &&
            latest.provider === sourceProvider.name &&
            latest.provider_result_id === match.provider_id &&
            latest.status === "finished" &&
            latest.home_score === result.homeScore &&
            latest.away_score === result.awayScore
          ) {
            await ctx.services.db.query(
              `update nova.matches
                  set status = 'finished'::nova.match_status,
                      home_score = $2, away_score = $3,
                      provider_updated_at = now(), updated_at = now()
                where id = $1 and provider = $4 and provider_id = $5`,
              [match.id, result.homeScore, result.awayScore, sourceProvider.name, match.provider_id],
            );
            continue;
          }

          const revision = (latest?.revision ?? 0) + 1;
          await ctx.services.db.query(
            `insert into nova.match_results
              (match_id, revision, status, home_score, away_score,
               home_half_score, away_half_score, home_corners, away_corners,
               home_cards, away_cards, extra_time, penalties, penalty_home,
               penalty_away, provider, provider_result_id, authoritative,
               observed_at, created_at)
             values ($1,$2,'finished',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17::timestamptz,now())`,
            [
              match.id, revision, result.homeScore, result.awayScore,
              result.homeHalfScore, result.awayHalfScore,
              result.homeCorners, result.awayCorners,
              result.homeCards, result.awayCards,
              result.extraTime, result.penalties,
              result.penaltyHome, result.penaltyAway,
              sourceProvider.name, match.provider_id, result.observedAt,
            ],
          );

          await ctx.services.db.query(
            `update nova.matches
                set status = 'finished'::nova.match_status,
                    home_score = $2, away_score = $3,
                    provider_updated_at = now(), updated_at = now()
              where id = $1 and provider = $4 and provider_id = $5`,
            [match.id, result.homeScore, result.awayScore, sourceProvider.name, match.provider_id],
          );
          await ctx.services.db.query(
            `update nova.markets
                set status = 'closed'::nova.market_status, updated_at = now()
              where match_id = $1 and status::text in ('open','suspended')`,
            [match.id],
          );
          await ctx.services.db.query(
            `update nova.selections
                set status = 'closed'::nova.selection_status, updated_at = now()
              where match_id = $1 and status::text in ('open','suspended')`,
            [match.id],
          );
          await ctx.services.db.query(
            `select nova.enqueue_match_settlement($1, $2)`,
            [match.id, `PROVIDER_RESULT_REV_${revision}`],
          );
          finished += 1;
        } else if (result.status === "live") {
          const latestFinal = await ctx.services.db.queryOne<{
            provider: string;
            provider_result_id: string | null;
            status: string;
            home_score: number | null;
            away_score: number | null;
          }>(
            `select provider, provider_result_id, status, home_score, away_score
               from nova.match_results
              where match_id = $1 and authoritative = true
              order by revision desc
              limit 1`,
            [match.id],
          );
          if (latestFinal?.status === "finished") {
            console.error("ODDS_LIVE_RESULT_AFTER_FINAL_REQUIRES_REVIEW", JSON.stringify({
              matchId: match.id,
              matchProvider: sourceProvider.name,
              finalProvider: latestFinal.provider,
              matchProviderId: match.provider_id,
              finalProviderId: latestFinal.provider_result_id,
            }));
            failed += 1;
            continue;
          }
          const scoreChanged =
            match.home_score !== result.homeScore ||
            match.away_score !== result.awayScore;

          if (scoreChanged) {
            await ctx.services.db.query(
              `update nova.markets
                  set status = 'suspended'::nova.market_status,
                      suspended_reason = 'LIVE_STATE_CHANGED',
                      suspended_at = now(), updated_at = now()
                where match_id = $1 and status::text = 'open'`,
              [match.id],
            );
            await ctx.services.db.query(
              `update nova.selections
                  set status = 'suspended'::nova.selection_status,
                      anomaly_codes = array_append(coalesce(anomaly_codes, '{}'::text[]), 'LIVE_STATE_CHANGED'),
                      updated_at = now()
                where match_id = $1 and status::text = 'open'`,
              [match.id],
            );
          }
          await ctx.services.db.query(
            `update nova.matches
                set status = 'live'::nova.match_status,
                    home_score = $2, away_score = $3,
                    provider_updated_at = now(), updated_at = now()
              where id = $1 and provider = $4 and provider_id = $5`,
            [match.id, result.homeScore, result.awayScore, sourceProvider.name, match.provider_id],
          );
          liveUpdated += 1;
        }
      } catch (error) {
        failed += 1;
        console.error("ODDS_RESULT_MATCH_FAILED", JSON.stringify({
          provider: sourceProvider.name,
          matchId: match.id,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  }

  return { checked, finished, liveUpdated, failed };
}
const PREMATCH_HORIZON_DAYS =
  process.env.SPORTS_PROVIDER === "5dollarfootballapi"
    ? 1
    : Math.max(
        14,
        Number(process.env.ODDS_API_PREMATCH_HORIZON_DAYS ?? 30) || 30,
      );
async function syncMatches(
  ctx: WorkerContext,
  providedResult?: Awaited<ReturnType<typeof ctx.services.providers.sports.fetchMatches>>,
  sourceProvider = ctx.services.providers.sports,
): Promise<{ synced: number }> {
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + PREMATCH_HORIZON_DAYS * 864e5).toISOString();

    console.log("SYNC_MATCHES_START", JSON.stringify({ from, to }));
  const result =
    providedResult ??
    await sourceProvider.fetchMatches({ from, to });
    console.log("SYNC_MATCHES_PROVIDER_RESULT", JSON.stringify({
      ok: result.ok,
      valueCount: result.value?.length ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      retryable: result.retryable ?? null,
    }));

  if (!result.ok || !result.value) {
    await recordProviderStatus(
      ctx,
      "error",
      result.errorMessage ?? "provider error",
      sourceProvider.name,
    );
    return { synced: 0 };
  }

  let synced = 0;
    console.log("SYNC_MATCHES_PROVIDER_EVENTS", result.value.length);

  const syncConcurrency = 6;
  for (let batchStart = 0; batchStart < result.value.length; batchStart += syncConcurrency) {
    const batch = result.value.slice(batchStart, batchStart + syncConcurrency);
    await Promise.all(batch.map(async (match) => {
    const sportRow = await ctx.services.db.queryOne<{ id: string }>(
      `select id from nova.sports where slug = $1 limit 1`,
      [match.sport],
    );

    if (!sportRow) return;

    const leagueSlug = match.leagueProviderId ?? "unknown";

    const league = await ctx.services.db.queryOne<{ id: string; logo: string | null }>(
      `insert into nova.leagues
         (sport_id, slug, name, name_fa, tier, is_active)
       values ($1, $2, $3, $3, 1, true)
       on conflict (sport_id, slug)
       do update set
         name = excluded.name,
         is_active = true,
         updated_at = now()
       returning id, logo`,
      [sportRow.id, leagueSlug, match.leagueName ?? leagueSlug],
    );

    if (!league) return;

    const homeSlug = match.homeTeamName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const awaySlug = match.awayTeamName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const homeTeam = await ctx.services.db.queryOne<{ id: string; logo: string | null }>(
      `insert into nova.teams
         (sport_id, slug, name, name_fa)
       values ($1, $2, $3, $3)
       on conflict (sport_id, slug)
       do update set
         name = excluded.name,
         updated_at = now()
       returning id, logo`,
      [sportRow.id, homeSlug, match.homeTeamName],
    );

    const awayTeam = await ctx.services.db.queryOne<{ id: string; logo: string | null }>(
      `insert into nova.teams
         (sport_id, slug, name, name_fa)
       values ($1, $2, $3, $3)
       on conflict (sport_id, slug)
       do update set
         name = excluded.name,
         updated_at = now()
       returning id, logo`,
      [sportRow.id, awaySlug, match.awayTeamName],
    );

    if (!homeTeam || !awayTeam) return;

    if (match.homeTeamProviderId) {
      await ctx.services.db.query(
        `insert into nova.provider_entities
           (provider, entity_type, provider_id, internal_id, last_seen_at)
         values ($1, 'team', $2, $3, now())
         on conflict (provider, entity_type, provider_id)
         do update set
           internal_id = excluded.internal_id,
           last_seen_at = now()`,
        [
          sourceProvider.name,
          match.homeTeamProviderId,
          homeTeam.id,
        ],
      );
    }

    if (match.awayTeamProviderId) {
      await ctx.services.db.query(
        `insert into nova.provider_entities
           (provider, entity_type, provider_id, internal_id, last_seen_at)
         values ($1, 'team', $2, $3, now())
         on conflict (provider, entity_type, provider_id)
         do update set
           internal_id = excluded.internal_id,
           last_seen_at = now()`,
        [
          sourceProvider.name,
          match.awayTeamProviderId,
          awayTeam.id,
        ],
      );
    }

      // Logo resolution is kept outside the critical match-sync path.
      // SportsDB latency must never block match persistence.

    let updated: { id: string } | null = null;
    try {
      updated = await ctx.services.db.queryOne<{ id: string }>(
      `insert into nova.matches
         (sport_id, league_id, home_team_id, away_team_id,
          status, home_score, away_score, minute, period,
          scheduled_at, provider, provider_id, provider_updated_at,
          started_at)
       values
         ($1, $2, $3, $4, $5::nova.match_status,
          $6, $7, $8, $9, $10::timestamptz,
          $11, $12, now(),
          case when $5::text in ('live','in_play','halftime','break')
               then $10::timestamptz else null end)
       on conflict (provider, provider_id)
       where provider is not null and provider_id is not null
       do update set
         sport_id = excluded.sport_id,
         league_id = excluded.league_id,
         home_team_id = excluded.home_team_id,
         away_team_id = excluded.away_team_id,
         status = case
           when nova.matches.status::text in ('live','paused','interrupted','finished')
                and excluded.status::text = 'scheduled'
             then nova.matches.status
           else excluded.status
         end,
         home_score = case
           when excluded.home_score is null
             and nova.matches.home_score is not null
             then nova.matches.home_score
           else excluded.home_score
         end,
         away_score = case
           when excluded.away_score is null
             and nova.matches.away_score is not null
             then nova.matches.away_score
           else excluded.away_score
         end,
         minute = case
           when nova.matches.status::text in ('live','paused','interrupted','finished')
                and excluded.status::text = 'scheduled'
             then nova.matches.minute
           else excluded.minute
         end,
         period = case
           when nova.matches.status::text in ('live','paused','interrupted','finished')
                and excluded.status::text = 'scheduled'
             then nova.matches.period
           else excluded.period
         end,
         scheduled_at = excluded.scheduled_at,
         provider_updated_at = now(),
         started_at = coalesce(nova.matches.started_at, excluded.started_at),
         updated_at = now()
       returning id`,
      [
        sportRow.id,
        league.id,
        homeTeam.id,
        awayTeam.id,
        match.status,
        match.homeScore,
        match.awayScore,
        match.minute,
        match.period,
        match.scheduledAt,
        sourceProvider.name,
        match.providerId,
      ],
    );

    } catch (error) {
      console.error(
        "MATCH_PERSISTENCE_FAILED",
        JSON.stringify({
          providerId: match.providerId,
          sport: match.sport,
          league: match.leagueName,
          home: match.homeTeamName,
          away: match.awayTeamName,
          status: match.status,
          scheduledAt: match.scheduledAt,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
    if (updated) synced += 1;
    }));
  }

  await recordProviderStatus(ctx, "healthy", null, sourceProvider.name);
  return { synced };
}

async function syncOdds(
  ctx: WorkerContext,
  matchId: string,
  prefetched?: Awaited<ReturnType<typeof ctx.services.providers.sports.fetchOdds>>,
): Promise<{ updated: number; rejected: number }> {
  const matchRow = await ctx.services.db.queryOne<{
    provider_id: string | null;
    provider: string | null;
  }>(
    `select provider_id, provider from nova.matches where id = $1`,
    [matchId],
  );
  if (!matchRow?.provider_id || !matchRow.provider) {
    return { updated: 0, rejected: 0 };
  }
  const sourceProvider =
    ctx.services.providers.sportsProviders?.find(
      (provider) => provider.name === matchRow.provider,
    ) ??
    (ctx.services.providers.sports.name === matchRow.provider
      ? ctx.services.providers.sports
      : null);
  if (!sourceProvider) {
    ctx.log.warn("ODDS_SYNC_PROVIDER_NOT_REGISTERED", {
      matchId,
      provider: matchRow.provider,
    });
    return { updated: 0, rejected: 0 };
  }
  const providerResult =
    prefetched ?? await sourceProvider.fetchOdds([matchRow.provider_id]);
  if (!providerResult.ok || !providerResult.value) return { updated: 0, rejected: 0 };
  if (
    providerResult.value.some(
      (bundle) => bundle.matchProviderId !== matchRow.provider_id,
    )
  ) {
    ctx.log.warn("ODDS_SYNC_PROVIDER_MATCH_ID_MISMATCH", {
      matchId,
      provider: matchRow.provider,
      expectedProviderId: matchRow.provider_id,
      receivedProviderIds: providerResult.value.map(
        (bundle) => bundle.matchProviderId,
      ),
    });
    return { updated: 0, rejected: 0 };
  }

  const locked = await ctx.withLock(
    `odds:match:${matchId}`,
    30,
    async () => syncOddsUnlocked(ctx, matchId, providerResult),
  );

  if (locked === null) {
    ctx.log.info("ODDS_SYNC_SKIPPED_MATCH_LOCK", { matchId });
    return { updated: 0, rejected: 0 };
  }

  return locked;
}


function normalizeProviderMarket(market: {
  key: string;
  type?: string;
  status: string;
  specifier?: string | null;
  isLive: boolean;
  providerId?: string;
}) {
  const key = String(market.key ?? '').trim();
  const upper = key.toUpperCase();
  const rule = marketRuleFor(key);

  const supportedProviderMarket =
    rule !== null &&
    ![
      'H2H_LAY',
      'H2H_3_WAY_LAY',
      'CORNERS_1X2',
      'TO_QUALIFY',
      'ODD_EVEN',
      'ODD_EVEN_H1',
      'ALTERNATE_SPREADS_CORNERS',
      'ALTERNATE_TOTALS_CORNERS',
      'ALTERNATE_SPREADS_CARDS',
      'ALTERNATE_TOTALS_CARDS',
      'ALTERNATE_TEAM_TOTALS_CORNERS',
      'PLAYER_GOAL_SCORER_ANYTIME',
      'PLAYER_FIRST_GOAL_SCORER',
      'PLAYER_LAST_GOAL_SCORER',
      'PLAYER_TO_RECEIVE_CARD',
      'PLAYER_TO_RECEIVE_RED_CARD',
      'PLAYER_SHOTS_ON_TARGET',
      'PLAYER_SHOTS',
      'PLAYER_ASSISTS',
    ].includes(upper);

  const status = supportedProviderMarket
    ? market.status
    : 'manual_review';

  const type = supportedProviderMarket
    ? rule.type
    : 'OTHER';

  const period =
    rule?.basis === 'FIRST_HALF'
      ? 'FIRST_HALF'
      : rule?.basis === 'SECOND_HALF'
        ? 'SECOND_HALF'
        : null;

  const displayOrder = rule ? marketDisplayOrder(rule.type) : 900;

  return {
    key,
    type,
    name: rule?.name ?? key,
    status,
    specifier: market.specifier ?? "",
    period,
    display_order: displayOrder,
    is_live: market.isLive,
    provider_market_id: market.providerId,
  };
}

async function syncOddsUnlocked(
  ctx: WorkerContext,
  matchId: string,
  prefetched?: Awaited<ReturnType<typeof ctx.services.providers.sports.fetchOdds>>,
): Promise<{ updated: number; rejected: number }> {
  const matchRow = await ctx.services.db.queryOne<{
    provider_id: string | null;
    provider: string | null;
  }>(
    `select provider_id, provider from nova.matches where id = $1`,
    [matchId],
  );
  if (!matchRow?.provider_id || !matchRow.provider) {
    return { updated: 0, rejected: 0 };
  }
  const sourceProvider =
    ctx.services.providers.sportsProviders?.find(
      (provider) => provider.name === matchRow.provider,
    ) ??
    (ctx.services.providers.sports.name === matchRow.provider
      ? ctx.services.providers.sports
      : null);
  if (!sourceProvider) {
    ctx.log.warn("ODDS_SYNC_PROVIDER_NOT_REGISTERED", {
      matchId,
      provider: matchRow.provider,
    });
    return { updated: 0, rejected: 0 };
  }
  const providerResult =
    prefetched ?? await sourceProvider.fetchOdds([matchRow.provider_id]);
  if (!providerResult.ok || !providerResult.value) return { updated: 0, rejected: 0 };
  if (
    providerResult.value.some(
      (bundle) => bundle.matchProviderId !== matchRow.provider_id,
    )
  ) {
    ctx.log.warn("ODDS_SYNC_PROVIDER_MATCH_ID_MISMATCH", {
      matchId,
      provider: matchRow.provider,
      expectedProviderId: matchRow.provider_id,
      receivedProviderIds: providerResult.value.map(
        (bundle) => bundle.matchProviderId,
      ),
    });
    return { updated: 0, rejected: 0 };
  }

  let updated = 0;
  let rejected = 0;
  const ticks: Array<Record<string, unknown>> = [];
  const liveLock = await ctx.services.db.queryOne<{ suspended_at: string | null }>(
    `select max(suspended_at) as suspended_at
       from nova.markets
      where match_id = $1
        and status::text = 'suspended'
        and suspended_reason = 'LIVE_STATE_CHANGED'`,
    [matchId],
  );

  const marketPayload = providerResult.value.flatMap((bundle) =>
    bundle.markets.map((market) => {
      const normalized = normalizeProviderMarket(market);
      return {
        ...normalized,
        provider: matchRow.provider,
      };
    }),
  );

  const h2hLayRuntimeAudit = marketPayload.filter((market) =>
    String(market.key ?? '').trim().toLowerCase() === 'h2h_lay',
  );
  if (h2hLayRuntimeAudit.length > 0) {
    console.log(
      'ODDS_H2H_LAY_RUNTIME_AUDIT',
      JSON.stringify({
        matchId,
        workerMode: process.env.ODDS_WORKER_MODE ?? null,
        count: h2hLayRuntimeAudit.length,
        markets: h2hLayRuntimeAudit.map((market) => ({
          key: market.key,
          status: market.status,
          type: market.type,
          name: market.name,
          specifier: market.specifier,
          provider: market.provider,
          providerMarketId: market.provider_market_id,
          isLive: market.is_live,
        })),
      }),
    );
  }

  if (marketPayload.length > 0) {
    console.log("ODDS_NORMALIZED_MARKET_PAYLOAD_AUDIT", JSON.stringify({
      matchId,
      providerId: matchRow.provider_id,
      workerMode: process.env.ODDS_WORKER_MODE ?? null,
      count: marketPayload.length,
      sample: marketPayload.slice(0, 30).map((m) => ({
        key: m.key,
        type: m.type,
        name: m.name,
        status: m.status,
        specifier: m.specifier,
        period: m.period,
        display_order: m.display_order,
        is_live: m.is_live,
        provider_market_id: m.provider_market_id,
      })),
    }));
    const marketRows = await ctx.services.db.query<{
      id: string;
      key: string;
      specifier: string | null;
    }>(
      `with input as (
         select *
         from jsonb_to_recordset($2::jsonb) as x(
           key text,
           type text,
           name text,
           status text,
           specifier text,
           period text,
           display_order integer,
           is_live boolean,
           provider text,
           provider_market_id text
         )
       )
       insert into nova.markets
         (match_id, key, type, name, name_fa, status, specifier,
          period, display_order, is_live, provider, provider_market_id)
       select
         $1::uuid,
         i.key,
         case
           when upper(i.key) in ('H2H', 'H2H_3_WAY') then '1X2'
           when upper(i.key) in ('SPREADS', 'ALTERNATE_SPREADS') then 'ASIAN_HANDICAP'
           when upper(i.key) in ('TOTALS', 'ALTERNATE_TOTALS') then 'OVER_UNDER'
           else i.type
         end,
         case
           when upper(i.key) in ('H2H', 'H2H_3_WAY') then 'Match Result'
           when upper(i.key) in ('SPREADS', 'ALTERNATE_SPREADS') then 'Asian Handicap'
           when upper(i.key) in ('TOTALS', 'ALTERNATE_TOTALS') then 'Total Goals'
           else i.name
         end,
         null,
         i.status::nova.market_status,
         i.specifier,
         i.period,
         i.display_order,
         i.is_live,
         i.provider,
         i.provider_market_id
       from input i
       on conflict (match_id, key, specifier)
       do update set
         type = excluded.type,
         name = excluded.name,
         status = case
           when lower(trim(excluded.key)) in (
             'h2h_lay',
             'h2h_3_way_lay',
             'corners_1x2',
             'to_qualify',
             'odd_even',
             'odd_even_h1',
             'alternate_spreads_corners',
             'alternate_totals_corners',
             'alternate_spreads_cards',
             'alternate_totals_cards',
             'alternate_team_totals_corners',
             'player_goal_scorer_anytime',
             'player_first_goal_scorer',
             'player_last_goal_scorer',
             'player_to_receive_card',
             'player_to_receive_red_card',
             'player_shots_on_target',
             'player_shots',
             'player_assists'
           )
           then 'manual_review'::nova.market_status
           when excluded.status::text = 'manual_review'
           then 'manual_review'::nova.market_status
           when nova.markets.status::text = 'manual_review'
           then 'manual_review'::nova.market_status
           when nova.markets.status::text = 'suspended'
            and nova.markets.suspended_reason = 'LIVE_STATE_CHANGED'
           then 'suspended'::nova.market_status
           else excluded.status
         end,
         specifier = excluded.specifier,
         period = excluded.period,
         display_order = excluded.display_order,
         is_live = excluded.is_live,
         provider = excluded.provider,
         provider_market_id = excluded.provider_market_id,
         updated_at = now()
       returning id, key, specifier`,
      [matchId, JSON.stringify(marketPayload)],
    );

    const marketIds = new Map<string, string>();
    for (const row of marketRows) {
      marketIds.set(`${row.key}:${row.specifier ?? ""}`, row.id);
    }

    const existingSelections = await ctx.services.db.query<{
      id: string;
      market_id: string;
      code: string;
      odds_scaled: string | null;
      provider_selection_id: string | null;
    }>(
      `select id, market_id, code, odds_scaled, provider_selection_id
         from nova.selections
        where match_id = $1`,
      [matchId],
    );

    const existingByKey = new Map(
      existingSelections.map((row) => [
        `${row.market_id}:${row.code}`,
        row,
      ]),
    );

    const selectionPayload: Array<Record<string, unknown>> = [];

    for (const bundle of providerResult.value) {
      for (const market of bundle.markets) {
        const marketId = marketIds.get(
          `${market.key}:${market.specifier ?? ""}`,
        );
        if (!marketId) continue;

        for (const quote of market.selections) {
          const participantType =
            quote.code === "HOME"
              ? "HOME"
              : quote.code === "AWAY"
                ? "AWAY"
                : quote.code === "DRAW"
                  ? "DRAW"
                  : "OTHER";

          const oddsScaled = oddsFromDecimalString(String(quote.odds));
          if (oddsScaled < 10100n) {
            console.warn(
              "5DOLLAR_ODDS_BELOW_DB_MIN",
              JSON.stringify({
                providerSelectionId: quote.providerId,
                odds: String(quote.odds),
                minOdds: "1.0100",
              }),
            );
            continue;
          }

          selectionPayload.push({
            market_id: marketId,
            code: quote.code,
            name: quote.name,
            line: quote.line,
            participant_type: participantType,
            status: quote.status,
            odds_scaled: oddsScaled.toString(),
            provider: matchRow.provider,
            provider_selection_id: quote.providerId,
            provider_timestamp: market.sourceUpdatedAt ?? bundle.updatedAt,
            is_live: market.isLive,
          });
        }
      }
    }

    if (selectionPayload.length > 0) {
      const selectionRows = await ctx.services.db.query<{
        id: string;
        market_id: string;
        code: string;
      }>(
        `with input as (
           select *
           from jsonb_to_recordset($2::jsonb) as x(
             market_id uuid,
             code text,
             name text,
             line text,
             participant_type text,
             status text,
             odds_scaled bigint,
             provider text,
             provider_selection_id text,
             provider_timestamp timestamptz,
             is_live boolean
           )
         )
         insert into nova.selections
           (market_id, match_id, code, name, name_fa, line,
            participant_type, status, odds_scaled, provider,
            provider_selection_id, provider_timestamp, is_live)
         select
           i.market_id,
           $1::uuid,
           i.code,
           i.name,
           null,
           i.line,
           i.participant_type,
           i.status::nova.selection_status,
           i.odds_scaled,
           i.provider,
           i.provider_selection_id,
           i.provider_timestamp,
           i.is_live
         from input i
         on conflict (market_id, code)
         do update set
           name = excluded.name,
           line = excluded.line,
           participant_type = excluded.participant_type,
           status = case
              when nova.selections.status::text <> 'open'
              then nova.selections.status
              else excluded.status
            end,
           provider = excluded.provider,
           provider_selection_id = excluded.provider_selection_id,
           provider_timestamp = excluded.provider_timestamp,
           is_live = excluded.is_live,
           updated_at = now()
         returning id, market_id, code`,
        [matchId, JSON.stringify(selectionPayload)],
      );

      const selectionIds = new Map(
        selectionRows.map((row) => [
          `${row.market_id}:${row.code}`,
          row.id,
        ]),
      );

      for (const bundle of providerResult.value) {
        for (const market of bundle.markets) {
          const marketId = marketIds.get(
            `${market.key}:${market.specifier ?? ""}`,
          );
          if (!marketId) continue;

          for (const quote of market.selections) {
            const current = oddsFromDecimalString(String(quote.odds));
            if (current < 10100n) {
              console.warn(
                "5DOLLAR_ODDS_BELOW_DB_MIN_TICK",
                JSON.stringify({
                  providerSelectionId: quote.providerId,
                  odds: String(quote.odds),
                  minOdds: "1.0100",
                }),
              );
              continue;
            }
            const selectionId = selectionIds.get(
              `${marketId}:${quote.code}`,
            );
            if (!selectionId) continue;

            const existingSelection = existingByKey.get(
              `${marketId}:${quote.code}`,
            );

            const sourceChanged =
              existingSelection !== undefined &&
              existingSelection.provider_selection_id !== null &&
              existingSelection.provider_selection_id !== quote.providerId;

            const previous =
              existingSelection === undefined || sourceChanged
                ? null
                : existingSelection.odds_scaled === null
                  ? null
                  : BigInt(existingSelection.odds_scaled);


            const anomalyObjects = detectOddsAnomalies({
              odds: current,
              previousOdds: previous,
              providerTimestamp: new Date(bundle.updatedAt),
              ingestedAt: new Date(),
              maxAgeSeconds: 300,
            });

            const anomalies = anomalyObjects.map((item) => item.code);
            const rejecting = hasRejecting(anomalyObjects);
            const suspending = hasSuspending(anomalyObjects);
            const ingestKey = quote.providerId + ":" + bundle.updatedAt;

            ticks.push({
              selection_id: selectionId,
              odds_scaled: current.toString(),
              provider: matchRow.provider,
              provider_timestamp: market.sourceUpdatedAt ?? bundle.updatedAt,
              is_live: market.isLive,
              ingest_key: ingestKey,
              anomalies,
              reject: rejecting,
              reject_reason: rejecting
                ? anomalyObjects
                    .filter((item) => item.severity === "REJECT")
                    .map((item) => item.code)
                    .join(",")
                : null,
              suspend: rejecting ? false : suspending,
            });
          }
        }
      }
    }
  }

  if (ticks.length > 0) {
    const result = await ctx.services.db.rpc<{
      count: number;
      accepted: number;
      rejected: number;
      duplicates: number;
    }>("publish_odds_tick_batch", { p_ticks: ticks });

    updated = Number(result?.accepted ?? 0);
    rejected = Number(result?.rejected ?? 0);


    const newestBundleTimestamp = providerResult.value.reduce<string | null>(
      (latest, bundle) =>
        !latest || new Date(bundle.updatedAt).getTime() > new Date(latest).getTime()
          ? bundle.updatedAt
          : latest,
      null,
    );

    const hasFreshOddsAfterLock =
      Boolean(liveLock?.suspended_at) &&
      Boolean(newestBundleTimestamp) &&
      new Date(newestBundleTimestamp!).getTime() >
        new Date(liveLock!.suspended_at!).getTime() &&
      updated > 0;

    if (hasFreshOddsAfterLock) {
      await ctx.services.db.query(
        `update nova.markets
            set status = 'open'::nova.market_status,
                suspended_reason = null,
                suspended_at = null,
                updated_at = now()
          where match_id = $1
            and status::text = 'suspended'
            and suspended_reason = 'LIVE_STATE_CHANGED'
            and is_live = true
            and exists (
              select 1
                from nova.matches m
               where m.id = nova.markets.match_id
                 and lower(coalesce(m.status::text, '')) = 'live'
            )`,
        [matchId],
      );

      await ctx.services.db.query(
        `update nova.selections s
            set status = 'open'::nova.selection_status,
                anomaly_codes = array_remove(
                  coalesce(s.anomaly_codes, '{}'::text[]),
                  'LIVE_STATE_CHANGED'
                ),
                updated_at = now()
          from nova.markets mk
          where mk.id = s.market_id
            and mk.match_id = s.match_id
            and mk.status::text = 'open'
            and s.match_id = $1
            and s.status::text = 'suspended'
            and s.is_live = true
            and 'LIVE_STATE_CHANGED' = any(
              coalesce(s.anomaly_codes, '{}'::text[])
            )`,
        [matchId],
      );

      console.log(
        "LIVE_MATCH_LOCK_RELEASED",
        JSON.stringify({
          matchId,
          acceptedOdds: updated,
          oddsUpdatedAt: newestBundleTimestamp,
          lockedAt: liveLock?.suspended_at ?? null,
        }),
      );
    }
  }

  // Never leave a live/open selection exposed when its odds feed has gone stale.
  // This must run even when the provider returned zero usable ticks.
  await ctx.services.db.query(
    `update nova.selections
        set status = 'suspended'::nova.selection_status,
            anomaly_codes = array_append(
              coalesce(anomaly_codes, '{}'::text[]),
              'STALE_ODDS'
            ),
            updated_at = now()
      where match_id = $1
        and status::text = 'open'
        and (
          (is_live = true and (
            odds_updated_at is null
            or odds_updated_at < now() - interval '45 seconds'
          ))
          or
          (is_live = false and (
            odds_updated_at is null
            or odds_updated_at < now() - interval '120 seconds'
          ))
        )`,
    [matchId],
  );

  return { updated, rejected };
}

async function recordProviderStatus(
  ctx: WorkerContext,
  status: string,
  error: string | null,
  providerName = ctx.services.providers.sports.name,
): Promise<void> {
  await ctx.services.db.query(
    `insert into nova.provider_health (provider, kind, status, last_success_at, last_error_at, last_error, updated_at)
     values ($1, 'sports', $2, case when $2 = 'healthy' then now() else null end,
             case when $2 <> 'healthy' then now() else null end, $3, now())
     on conflict (provider, kind) do update
       set status = excluded.status,
           last_success_at = coalesce(excluded.last_success_at, nova.provider_health.last_success_at),
           last_error_at = coalesce(excluded.last_error_at, nova.provider_health.last_error_at),
           last_error = excluded.last_error, updated_at = now()`,
    [providerName, status, error],
  ).catch(() => undefined);
}
