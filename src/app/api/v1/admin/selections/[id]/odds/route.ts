import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';
import { logger } from '@/server/logger';
import { MIN_DECIMAL_ODDS, MAX_DECIMAL_ODDS } from '@/domain/odds';

export const dynamic = 'force-dynamic';

const schema = z.object({
  oddsScaled: z.string().regex(/^\d{1,12}$/),
  reason: z.string().min(8).max(300),
});

/**
 * Trader odds override. Writes a new odds version + history row so the change is
 * visible to customers (OLD -> NEW) and fully auditable.
 */
export const POST = withErrorHandling('admin.selections.odds', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'odds.edit');
  const body = await readJson(request, schema, ctx);
  const scaled = BigInt(body.oddsScaled);
  if (scaled < MIN_DECIMAL_ODDS || scaled > MAX_DECIMAL_ODDS) throw new ApiError('ODDS_OUT_OF_RANGE', 'Odds are outside the allowed band');
  const current = await services.db.queryOne<Record<string, unknown>>(`select id, odds_scaled, odds_version, is_live from nova.selections where id = $1`, [id]);
  if (!current) throw new ApiError('NOT_FOUND', 'Selection not found');
  const row = await services.db.queryOne<Record<string, unknown>>(
    `update nova.selections set previous_odds_scaled = odds_scaled, odds_scaled = $2, odds_version = odds_version + 1,
        odds_updated_at = now(), updated_at = now()
      where id = $1 returning id, odds_scaled, previous_odds_scaled, odds_version`,
    [id, scaled.toString()],
  );
  let historyRecorded = true;
  try {
    await services.db.query(
      `insert into nova.odds_history (selection_id, provider, odds_scaled, previous_odds_scaled, odds_version, status, is_live, provider_timestamp, ingest_key)
       values ($1, 'manual', $2, $3, $4, 'manual_override', $5, now(), $6)`,
      [id, scaled.toString(), String(current.odds_scaled), Number(current.odds_version ?? 1), Boolean(current.is_live), `manual:${id}:${Date.now()}`],
    );
  } catch (error) {
    // The override is already applied; losing its audit row silently would break the odds trail.
    historyRecorded = false;
    logger.error('admin.odds.override.history_insert_failed', {
      selectionId: id, correlationId: actor.correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  await services.admin.writeAudit({
    actorId: user.id, action: 'odds.override', entityType: 'selection', entityId: id,
    before: { oddsScaled: String(current.odds_scaled) }, after: { oddsScaled: body.oddsScaled },
    reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonOk({ selection: row, historyRecorded });
});
