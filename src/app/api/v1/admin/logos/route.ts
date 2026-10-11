import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { createServices } from '@/server/services/container';

export const dynamic = 'force-dynamic';

interface SportBreakdown {
  sport: string;
  total: number;
  withLogo: number;
  missing: number;
}

/** Logo coverage stats: totals + per-sport breakdown + cache + worker state. */
export const GET = withErrorHandling('admin.logos', async (ctx, request: Request) => {
  await withAdmin(request, ctx, 'dashboard.view');
  const services = createServices();
  const db = services.db;

  const teamTotals = await db.queryOne<{ total: number; with_logo: number }>(
    `select count(*)::int as total,
            count(*) filter (where logo is not null and logo <> '')::int as with_logo
       from nova.teams`,
  );
  const leagueTotals = await db.queryOne<{ total: number; with_logo: number }>(
    `select count(*)::int as total,
            count(*) filter (where logo is not null and logo <> '')::int as with_logo
       from nova.leagues`,
  );
  const teamSports = await db.query<{ sport: string; total: number; with_logo: number }>(
    `select s.slug as sport, count(*)::int as total,
            count(*) filter (where t.logo is not null and t.logo <> '')::int as with_logo
       from nova.teams t
       join nova.sports s on s.id = t.sport_id
      group by s.slug
      order by count(*) desc`,
  );
  const leagueSports = await db.query<{ sport: string; total: number; with_logo: number }>(
    `select s.slug as sport, count(*)::int as total,
            count(*) filter (where l.logo is not null and l.logo <> '')::int as with_logo
       from nova.leagues l
       join nova.sports s on s.id = l.sport_id
      group by s.slug
      order by count(*) desc`,
  );
  const cacheStats = await db.query<{ source: string | null; total: number; hits: number }>(
    `select source, count(*)::int as total,
            count(*) filter (where logo_url is not null)::int as hits
       from nova.logo_cache
      group by source
      order by count(*) desc`,
  ).catch(() => []);
  const heartbeat = await db.queryOne<{ worker: string; last_seen_at: string; metadata: Record<string, unknown> }>(
    `select worker, last_seen_at, metadata
       from nova.worker_heartbeats
      where worker = 'logo'
      order by last_seen_at desc
      limit 1`,
  ).catch(() => null);
  const missingSamples = await db.query<{ name: string; sport: string }>(
    `select t.name, s.slug as sport
       from nova.teams t
       join nova.sports s on s.id = t.sport_id
      where t.logo is null
      order by t.updated_at desc
      limit 15`,
  );

  const toBreakdown = (rows: { sport: string; total: number; with_logo: number }[]): SportBreakdown[] =>
    rows.map((row) => ({
      sport: row.sport,
      total: row.total,
      withLogo: row.with_logo,
      missing: row.total - row.with_logo,
    }));

  return jsonOk({
    teams: {
      total: teamTotals?.total ?? 0,
      withLogo: teamTotals?.with_logo ?? 0,
      missing: (teamTotals?.total ?? 0) - (teamTotals?.with_logo ?? 0),
      bySport: toBreakdown(teamSports),
    },
    leagues: {
      total: leagueTotals?.total ?? 0,
      withLogo: leagueTotals?.with_logo ?? 0,
      missing: (leagueTotals?.total ?? 0) - (leagueTotals?.with_logo ?? 0),
      bySport: toBreakdown(leagueSports),
    },
    cache: cacheStats.map((row) => ({
      source: row.source ?? 'miss',
      total: row.total,
      hits: row.hits,
    })),
    worker: heartbeat
      ? {
          status: String(heartbeat.metadata?.status ?? 'unknown'),
          updatedAt: heartbeat.last_seen_at,
          processed: Number(heartbeat.metadata?.processed ?? 0),
          failed: Number(heartbeat.metadata?.failed ?? 0),
        }
      : null,
    missingSamples,
  });
});

/** Enqueue an on-demand logo sweep. */
export const POST = withErrorHandling('admin.logos.sweep', async (ctx, request: Request) => {
  await withAdmin(request, ctx, 'settings.edit');
  const services = createServices();
  const at = new Date().toISOString();
  const result = await services.db.rpc<{ id: string; duplicate: boolean }>('enqueue_job', {
    p_queue: 'logo',
    p_job_key: 'logo.sweep',
    p_payload: { triggeredBy: 'admin', at },
    p_idempotency_key: 'logo.sweep:' + at,
    p_run_at: at,
    p_max_attempts: 3,
  });
  return jsonOk({ jobId: result.id, duplicate: result.duplicate });
});
