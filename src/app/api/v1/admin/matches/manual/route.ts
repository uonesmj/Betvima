import { z } from 'zod';
import { ApiError, jsonOk, withErrorHandling } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';
import { oddsFromDecimalString, MIN_DECIMAL_ODDS, MAX_DECIMAL_ODDS } from '@/domain/odds';

export const dynamic = 'force-dynamic';

// Only full-time 1X2 until all additional market settlement rules are verified.
const schema = z.object({
  league: z.string().trim().min(2).max(120),
  homeTeam: z.string().trim().min(2).max(120),
  awayTeam: z.string().trim().min(2).max(120),
  scheduledAt: z.string().datetime({ offset: true }),
  homeOdds: z.string().regex(/^\d+(\.\d{1,4})?$/),
  drawOdds: z.string().regex(/^\d+(\.\d{1,4})?$/),
  awayOdds: z.string().regex(/^\d+(\.\d{1,4})?$/),
});

function slug(name: string): string {
  return name.normalize('NFKC').toLocaleLowerCase('en').trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 100);
}

/** Operator-only, atomic creation of a manual pre-match 1X2 football fixture. */
export const POST = withErrorHandling('admin.matches.manual.create', async (ctx, request: Request) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'matches.manage');
  const body = await readJson(request, schema, ctx);
  const kickoff = new Date(body.scheduledAt);
  if (kickoff.getTime() < Date.now() + 10 * 60_000) {
    throw new ApiError('BAD_REQUEST', 'Kick-off must be at least 10 minutes in the future');
  }
  if (body.homeTeam.toLocaleLowerCase() === body.awayTeam.toLocaleLowerCase()) {
    throw new ApiError('BAD_REQUEST', 'The home and away teams must differ');
  }
  const prices = [body.homeOdds, body.drawOdds, body.awayOdds].map((value) => oddsFromDecimalString(value));
  if (prices.some((value) => value < MIN_DECIMAL_ODDS || value > MAX_DECIMAL_ODDS)) {
    throw new ApiError('ODDS_OUT_OF_RANGE', 'Odds must be between 1.01 and 1000.00');
  }

  const matchId = await services.db.transaction(async (tx) => {
    const sport = await tx.queryOne<{ id: string }>(
      "select id from nova.sports where slug = 'football' and is_active limit 1",
    );
    if (!sport) throw new ApiError('NOT_FOUND', 'Football sport not configured');

    // Serialize operator creation of the same fixture; prevents concurrent duplicates.
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', [
      `manual:${slug(body.homeTeam)}:${slug(body.awayTeam)}:${kickoff.toISOString().slice(0, 13)}`,
    ]);

    // Do not create a manual duplicate of an already imported Odds API fixture.
    const duplicate = await tx.queryOne<{ id: string }>(
      `select m.id from nova.matches m
        join nova.teams ht on ht.id = m.home_team_id
        join nova.teams at on at.id = m.away_team_id
       where m.sport_id = $1
         and lower(ht.name) = lower($2)
         and lower(at.name) = lower($3)
         and abs(extract(epoch from (m.scheduled_at - $4::timestamptz))) <= 5400
         and m.status::text not in ('cancelled','abandoned')
       limit 1`,
      [sport.id, body.homeTeam, body.awayTeam, kickoff.toISOString()],
    );
    if (duplicate) throw new ApiError('BAD_REQUEST', 'A matching fixture already exists');

    const leagueSlug = 'manual-' + slug(body.league);
    const league = await tx.queryOne<{ id: string }>(
      `insert into nova.leagues (sport_id, slug, name, is_active)
       values ($1, $2, $3, true)
       on conflict (sport_id, slug) do update set is_active = true
       returning id`,
      [sport.id, leagueSlug, body.league],
    );
    if (!league) throw new ApiError('NOT_FOUND', 'Unable to resolve league');

    const teamId = async (name: string): Promise<string> => {
      const existing = await tx.queryOne<{ id: string }>(
        'select id from nova.teams where sport_id = $1 and lower(name) = lower($2) limit 1',
        [sport.id, name],
      );
      if (existing) return existing.id;
      const created = await tx.queryOne<{ id: string }>(
        `insert into nova.teams (sport_id, slug, name)
         values ($1, $2, $3)
         on conflict (sport_id, slug) do update set updated_at = now()
         returning id`,
        [sport.id, 'manual-' + slug(name), name],
      );
      if (!created) throw new ApiError('NOT_FOUND', 'Unable to resolve team');
      return created.id;
    };
    const homeId = await teamId(body.homeTeam);
    const awayId = await teamId(body.awayTeam);
    const created = await tx.queryOne<{ id: string }>(
      `insert into nova.matches (
         sport_id, league_id, home_team_id, away_team_id, scheduled_at,
         status, provider, provider_id
       ) values ($1,$2,$3,$4,$5,'scheduled'::nova.match_status,'manual',gen_random_uuid()::text)
       returning id`,
      [sport.id, league.id, homeId, awayId, kickoff.toISOString()],
    );
    if (!created) throw new ApiError('NOT_FOUND', 'Unable to create fixture');

    const market = await tx.queryOne<{ id: string }>(
      `insert into nova.markets (match_id, key, type, name, status, is_live, provider, display_order)
       values ($1,'1X2','1X2','Match Result','open'::nova.market_status,false,'manual',1)
       returning id`,
      [created.id],
    );
    if (!market) throw new ApiError('NOT_FOUND', 'Unable to create market');

    const options = [
      { code: 'HOME', name: body.homeTeam, kind: 'HOME' },
      { code: 'DRAW', name: 'Draw', kind: 'NEUTRAL' },
      { code: 'AWAY', name: body.awayTeam, kind: 'AWAY' },
    ];
    for (let i = 0; i < options.length; i++) {
      const option = options[i]!;
      const selection = await tx.queryOne<{ id: string }>(
        `insert into nova.selections
          (market_id, match_id, code, name, participant_type, status,
           odds_scaled, odds_version, odds_updated_at, provider, is_live)
         values ($1,$2,$3,$4,$5,'open'::nova.selection_status,$6,1,now(),'manual',false)
         returning id`,
        [market.id, created.id, option.code, option.name, option.kind, prices[i]!.toString()],
      );
      if (!selection) throw new ApiError('NOT_FOUND', 'Unable to create selection');
      // Keep a complete first-price audit trail, in the same transaction.
      await tx.query(
        `insert into nova.odds_history (
           selection_id, provider, odds_scaled, previous_odds_scaled,
           odds_version, status, is_live, provider_timestamp, ingest_key
         ) values ($1,'manual',$2,null,1,'manual_creation',false,now(),$3)`,
        [selection.id, prices[i]!.toString(), `manual:create:${selection.id}`],
      );
    }
    return created.id;
  });

  await services.admin.writeAudit({
    actorId: user.id, action: 'match.manual_created', entityType: 'match', entityId: matchId,
    after: { league: body.league, homeTeam: body.homeTeam, awayTeam: body.awayTeam, scheduledAt: kickoff.toISOString(), market: '1X2' },
    reason: 'operator entered prematch fixture', correlationId: actor.correlationId,
  });
  return jsonOk({ matchId });
});

/** Admin history includes manually created matches after kick-off. */
export const GET = withErrorHandling('admin.matches.manual.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'matches.manage');
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(5000, Number(params.get('page')) || 1));
  const pageSize = Math.max(1, Math.min(50, Number(params.get('pageSize')) || 25));
  const q = params.get('q')?.trim().slice(0, 120) || null;
  const baseSql = `
    from nova.matches m
    join nova.sports sport on sport.id = m.sport_id
    join nova.leagues league on league.id = m.league_id
    join nova.teams ht on ht.id = m.home_team_id
    join nova.teams at on at.id = m.away_team_id
    where m.provider = 'manual'
      and ($1::text is null
        or ht.name ilike '%' || $1 || '%'
        or at.name ilike '%' || $1 || '%'
        or league.name ilike '%' || $1 || '%')
  `;
  const [rows, count] = await Promise.all([
    services.db.query<{
      id: string; sportKey: string; leagueName: string; status: string;
      scheduledAt: string; homeScore: number | null; awayScore: number | null;
      isLive: boolean; isBettingAvailable: boolean; participants: {role: string; name: string}[];
      marketsCount: number; provider: string;
    }>(`
      select m.id, sport.slug as "sportKey", league.name as "leagueName",
        m.status::text as status, m.scheduled_at as "scheduledAt",
        m.home_score as "homeScore", m.away_score as "awayScore",
        false as "isLive",
        (m.status::text = 'scheduled' and m.scheduled_at > now()) as "isBettingAvailable",
        jsonb_build_array(
          jsonb_build_object('role','HOME','name',ht.name),
          jsonb_build_object('role','AWAY','name',at.name)
        ) as participants,
        (select count(*)::int from nova.markets mk where mk.match_id = m.id) as "marketsCount",
        m.provider
      ${baseSql}
      order by
        case when m.status::text = 'scheduled' and m.scheduled_at <= now() then 0
             when m.status::text = 'scheduled' then 1 else 2 end,
        m.scheduled_at desc, m.id desc
      limit $2 offset $3
    `, [q, pageSize, (page - 1) * pageSize]),
    services.db.queryOne<{ total: number }>(`select count(*)::int as total ${baseSql}`, [q]),
  ]);
  return jsonOk({ items: rows, total: count?.total ?? 0, page, pageSize });
});
