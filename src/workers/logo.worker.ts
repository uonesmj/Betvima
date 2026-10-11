/**
 * LOGO WORKER — backfills REAL team/league badges for every sport.
 *
 * The odds providers ship names without artwork, so this worker sweeps
 * `nova.teams` / `nova.leagues` rows with a NULL logo, resolves official
 * badges through the logo pipeline (ESPN -> TheSportsDB, both verified),
 * HEAD-verifies every URL is a real image, and stores it. Confirmed misses
 * are cached negatively so upstream APIs are never re-hammered.
 *
 * Only verified http(s) image URLs are ever written — never placeholders.
 *
 * Triggers:
 *   * periodic tick (LOGO_WORKER_INTERVAL_MS, default 10 min)
 *   * on-demand `logo.sweep` jobs on the `logo` queue
 *   * one-shot backfill: NOVA_WORKER_ONCE=true npm run worker:logo
 */

import { pgArray } from "@/server/db/rows";
import { createWorker, type JobHandler, type WorkerContext } from "./runtime";
import {
  readLogoCache,
  resolveLeagueLogoDetailed,
  resolveTeamLogoDetailed,
  verifyLogoUrl,
  writeLogoCache,
} from "@/server/services/logo-resolver";

const TEAM_BATCH = Math.max(1, Number(process.env.LOGO_WORKER_TEAM_BATCH ?? 30) || 30);
const LEAGUE_BATCH = Math.max(1, Number(process.env.LOGO_WORKER_LEAGUE_BATCH ?? 10) || 10);
const INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.LOGO_WORKER_INTERVAL_MS ?? 10 * 60_000) || 10 * 60_000,
);

/**
 * Sports that never get a team badge: their "teams" are individual athletes
 * (tennis/boxing/MMA singles). Leaving them NULL is honest — the UI shows an
 * initial instead, and no placeholder is ever invented.
 */
const SKIPPED_SPORTS = (process.env.LOGO_SKIP_SPORTS ?? "mma,boxing,tennis,table-tennis")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Sports ordered by how reliably a real badge exists AND how much the site
 * shows them. Esports entries are mostly gamer handles ("Mexico (Legion)"),
 * so they are tried last instead of consuming the whole budget.
 */
const SPORT_PRIORITY = [
  "football",
  "basketball",
  "american-football",
  "ice-hockey",
  "baseball",
  "handball",
  "volleyball",
  "cricket",
  "esports",
];
const SPORT_RANK_CASE = SPORT_PRIORITY.map((sport, index) => `when '${sport}' then ${index}`).join(" ");
const sportRank = (column: string) => `case ${column} ${SPORT_RANK_CASE} else ${SPORT_PRIORITY.length} end`;

interface TeamRow {
  id: string;
  name: string;
  sport: string;
}

interface LeagueRow {
  id: string;
  name: string;
  slug: string;
  sport: string;
}

async function sweepTeams(ctx: WorkerContext): Promise<{ resolved: number; missed: number; failed: number }> {
  const db = ctx.services.db;
  const rows = await db.query<TeamRow>(
    `select t.id, t.name, s.slug as sport
       from nova.teams t
       join nova.sports s on s.id = t.sport_id
       left join nova.matches m
         on (m.home_team_id = t.id or m.away_team_id = t.id)
        and m.scheduled_at > now() - interval '14 days'
      where t.logo is null
        and s.slug <> all($2::text[])
      group by t.id, t.name, s.slug
      order by ${sportRank("s.slug")}, count(m.id) desc, t.updated_at desc
      limit $1`,
    [TEAM_BATCH, pgArray(SKIPPED_SPORTS)],
  );

  let resolved = 0;
  let missed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const cached = await readLogoCache(db, "team", row.sport, row.name);
      if (cached?.status === "hit") {
        await db.query(`update nova.teams set logo = $1, updated_at = now() where id = $2 and logo is null`, [
          cached.url,
          row.id,
        ]);
        resolved += 1;
        continue;
      }
      if (cached?.status === "miss") {
        missed += 1;
        continue;
      }
      const hit = await resolveTeamLogoDetailed(row.name, row.sport);
      if (hit && (await verifyLogoUrl(hit.url))) {
        await db.query(`update nova.teams set logo = $1, updated_at = now() where id = $2 and logo is null`, [
          hit.url,
          row.id,
        ]);
        await writeLogoCache(db, "team", row.sport, row.name, hit);
        resolved += 1;
        ctx.log.info("LOGO_TEAM_RESOLVED", { team: row.name, sport: row.sport, source: hit.source });
      } else {
        await writeLogoCache(db, "team", row.sport, row.name, null);
        missed += 1;
      }
    } catch (error) {
      failed += 1;
      ctx.log.warn("LOGO_TEAM_FAILED", { team: row.name, sport: row.sport, error: (error as Error).message });
    }
  }

  return { resolved, missed, failed };
}

async function sweepLeagues(ctx: WorkerContext): Promise<{ resolved: number; missed: number; failed: number }> {
  const db = ctx.services.db;
  const rows = await db.query<LeagueRow>(
    `select l.id, l.name, l.slug, s.slug as sport
       from nova.leagues l
       join nova.sports s on s.id = l.sport_id
       left join nova.matches m
         on m.league_id = l.id
        and m.scheduled_at > now() - interval '14 days'
      where l.logo is null
        and s.slug <> all($2::text[])
      group by l.id, l.name, l.slug, s.slug
      order by ${sportRank("s.slug")}, count(m.id) desc, l.updated_at desc
      limit $1`,
    [LEAGUE_BATCH, pgArray(SKIPPED_SPORTS)],
  );

  let resolved = 0;
  let missed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const cached = await readLogoCache(db, "league", row.sport, row.name || row.slug);
      if (cached?.status === "hit") {
        await db.query(`update nova.leagues set logo = $1, updated_at = now() where id = $2 and logo is null`, [
          cached.url,
          row.id,
        ]);
        resolved += 1;
        continue;
      }
      if (cached?.status === "miss") {
        missed += 1;
        continue;
      }
      const hit = await resolveLeagueLogoDetailed({ leagueSlug: row.slug, leagueName: row.name });
      if (hit && (await verifyLogoUrl(hit.url))) {
        await db.query(`update nova.leagues set logo = $1, updated_at = now() where id = $2 and logo is null`, [
          hit.url,
          row.id,
        ]);
        await writeLogoCache(db, "league", row.sport, row.name || row.slug, hit);
        resolved += 1;
        ctx.log.info("LOGO_LEAGUE_RESOLVED", { league: row.name, sport: row.sport, source: hit.source });
      } else {
        await writeLogoCache(db, "league", row.sport, row.name || row.slug, null);
        missed += 1;
      }
    } catch (error) {
      failed += 1;
      ctx.log.warn("LOGO_LEAGUE_FAILED", { league: row.name, sport: row.sport, error: (error as Error).message });
    }
  }

  return { resolved, missed, failed };
}

async function sweep(ctx: WorkerContext): Promise<Record<string, unknown>> {
  const started = Date.now();
  const teams = await sweepTeams(ctx);
  const leagues = await sweepLeagues(ctx);
  const summary = {
    teams,
    leagues,
    durationMs: Date.now() - started,
  };
  ctx.log.info("LOGO_SWEEP_DONE", summary);
  return summary;
}

const handlers: JobHandler[] = [
  {
    kinds: ["logo.sweep"],
    async handle(_job, ctx) {
      const result = await ctx.withLock("logo:tick", 540, async () => sweep(ctx));
      return result ?? { skipped: "lock-held" };
    },
  },
];

createWorker({
  queue: "logo",
  handlers,
  tickIntervalMs: INTERVAL_MS,
  pollIntervalMs: 30_000,
  batchSize: 1,
  async tick(ctx) {
    await ctx.withLock("logo:tick", 540, async () => {
      await sweep(ctx);
    });
  },
});
