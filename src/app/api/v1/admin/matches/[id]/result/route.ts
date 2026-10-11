import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({
  status: z.enum(['finished', 'cancelled', 'abandoned', 'postponed', 'interrupted', 'corrected']),
  homeScore: z.number().int().min(0).max(999).nullable().optional(),
  awayScore: z.number().int().min(0).max(999).nullable().optional(),
  homeHalfScore: z.number().int().min(0).max(999).nullable().optional(),
  awayHalfScore: z.number().int().min(0).max(999).nullable().optional(),
  homeCorners: z.number().int().min(0).max(999).nullable().optional(),
  awayCorners: z.number().int().min(0).max(999).nullable().optional(),
  homeCards: z.number().int().min(0).max(99).nullable().optional(),
  awayCards: z.number().int().min(0).max(99).nullable().optional(),
  extraTime: z.boolean().default(false),
  penalties: z.boolean().default(false),
  penaltyHome: z.number().int().min(0).max(99).nullable().optional(),
  penaltyAway: z.number().int().min(0).max(99).nullable().optional(),
  note: z.string().max(500).optional(),
});

/**
 * Operator-entered result. Stored as a NEW REVISION in `nova.match_results` with
 * `authoritative = true`; the settlement worker then settles (or regrades) affected bets.
 */
export const POST = withErrorHandling('admin.matches.result', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'matches.manage');
  const body = await readJson(request, schema, ctx);
  const row = await services.db.queryOne<Record<string, unknown>>(
    `insert into nova.match_results
       (match_id, revision, status, home_score, away_score, home_half_score, away_half_score, home_corners, away_corners,
        home_cards, away_cards, extra_time, penalties, penalty_home, penalty_away, provider, authoritative, observed_at, created_by)
     select $1, coalesce(max(revision),0) + 1, $2::match_result_status, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'manual', true, now(), $15
       from nova.match_results where match_id = $1
     returning id, revision, status`,
    [id, body.status, body.homeScore ?? null, body.awayScore ?? null, body.homeHalfScore ?? null, body.awayHalfScore ?? null,
      body.homeCorners ?? null, body.awayCorners ?? null, body.homeCards ?? null, body.awayCards ?? null,
      body.extraTime, body.penalties, body.penaltyHome ?? null, body.penaltyAway ?? null, user.id],
  );
  // Queuing the re-settlement jobs is part of the operator action, not a nice-to-have: a silent
  // failure would leave corrected results unsettled. A failure is reported to the caller
  // (settlementQueued: false) instead of being hidden, and the recorded result is kept.
  let settlementQueued = true;
  try {
    await services.db.query(
      `insert into nova.settlement_jobs (bet_id, match_id, user_id, status, reason)
       select b.id, $1, b.user_id, 'queued', 'manual result revision'
         from nova.bets b join nova.bet_legs l on l.bet_id = b.id
        where l.match_id = $1 and b.status in ('accepted','partially_settled')`,
      [id],
    );
  } catch (error) {
    settlementQueued = false;
    logger.error('admin.match.result.settlement_enqueue_failed', {
      matchId: id, correlationId: actor.correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  await services.admin.writeAudit({
    actorId: user.id, action: 'match.result_recorded', entityType: 'match', entityId: id,
    after: { ...body, revision: row?.revision }, reason: body.note ?? 'manual result entry', correlationId: actor.correlationId,
  });
  return jsonOk({ result: row, settlementQueued });
});
