import { z } from 'zod';
import { withErrorHandling, jsonOk, ApiError } from '@/lib/errors';
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

  // Manual fixture results must retain exact match ownership. The settlement
  // service refuses results with mismatched or missing provider_result_id.
  const owner = await services.db.queryOne<{ provider: string | null }>(
    'select provider from nova.matches where id = $1', [id],
  );
  if (owner?.provider === 'manual') {
    if (!['finished', 'cancelled', 'abandoned'].includes(body.status)) {
      throw new ApiError('VALIDATION_ERROR', 'For manual fixtures, enter a final result or cancellation');
    }
    if (body.status === 'finished' && (body.homeScore == null || body.awayScore == null)) {
      throw new ApiError('VALIDATION_ERROR', 'Full-time scores are required');
    }
    const saved = await services.db.transaction(async (tx) => {
      const match = await tx.queryOne<{ id: string; provider_id: string | null; status: string }>(
        'select id, provider_id, status::text from nova.matches where id = $1 and provider = $2 for update',
        [id, 'manual'],
      );
      if (!match || !match.provider_id) throw new ApiError('NOT_FOUND', 'Manual fixture missing provider identity');
      const finalAlready = await tx.queryOne<{ id: string }>(
        `select id from nova.match_results where match_id = $1 and authoritative = true
         and status in ('finished','cancelled','abandoned') order by revision desc limit 1`, [id],
      );
      if (finalAlready) {
        throw new ApiError('VALIDATION_ERROR', 'Final result already exists; use the controlled regrade process for corrections');
      }
      const result = await tx.queryOne<{ id: string; revision: number; status: string }>(
        `insert into nova.match_results (
          match_id, revision, status, home_score, away_score,
          home_half_score, away_half_score, home_corners, away_corners,
          home_cards, away_cards, extra_time, penalties, penalty_home, penalty_away,
          provider, provider_result_id, authoritative, observed_at, created_by
        )
        select $1, coalesce(max(revision),0)+1, $2, $3, $4, $5, $6, $7, $8,
               $9, $10, $11, $12, $13, $14, 'manual', $15, true, now(), $16
        from nova.match_results where match_id = $1
        returning id, revision, status`,
        [id, body.status, body.homeScore ?? null, body.awayScore ?? null,
          body.homeHalfScore ?? null, body.awayHalfScore ?? null,
          body.homeCorners ?? null, body.awayCorners ?? null,
          body.homeCards ?? null, body.awayCards ?? null,
          body.extraTime, body.penalties, body.penaltyHome ?? null, body.penaltyAway ?? null,
          match.provider_id, user.id],
      );
      await tx.query(
        `update nova.matches set status = $2::nova.match_status,
          home_score = $3, away_score = $4, finished_at = now(),
          result_revision = $5, updated_at = now()
         where id = $1 and provider = 'manual'`,
        [id, body.status, body.homeScore ?? null, body.awayScore ?? null, result?.revision ?? 1],
      );
      await tx.query(
        `update nova.markets set status = 'closed'::nova.market_status, updated_at = now()
         where match_id = $1 and status::text in ('open','suspended')`, [id],
      );
      await tx.query(
        `update nova.selections set status = 'closed'::nova.selection_status, updated_at = now()
         where match_id = $1 and status::text in ('open','suspended')`, [id],
      );
      // A queue failure must roll back the result rather than silently leave
      // users waiting with a successful operator response.
      await tx.query('select nova.enqueue_match_settlement($1, $2)', [
        id, `MANUAL_RESULT_REV_${result?.revision ?? 1}`,
      ]);
      return result;
    });
    await services.admin.writeAudit({
      actorId: user.id, action: 'match.result_recorded', entityType: 'match', entityId: id,
      after: { ...body, revision: saved?.revision, provider: 'manual' },
      reason: body.note ?? 'manual result entry', correlationId: actor.correlationId,
    });
    return jsonOk({ result: saved, settlementQueued: true });
  }
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
