import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const bigintString = z.string().regex(/^\d{1,19}$/);

const schema = z.object({
  maxStakePerBetMinor: bigintString.nullable().optional(),
  maxStakePerDayMinor: bigintString.nullable().optional(),
  lossLimitDailyMinor: bigintString.nullable().optional(),
  lossLimitWeeklyMinor: bigintString.nullable().optional(),
  depositLimitDailyMinor: bigintString.nullable().optional(),
  depositLimitWeeklyMinor: bigintString.nullable().optional(),
  sessionLimitMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  selfExcludeUntil: z.string().datetime({ offset: true }).nullable().optional(),
});

/** Responsible-gambling limits: enforceable, server-side, and audited. */
export const GET = withErrorHandling('account.limits.get', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  return jsonOk({ limits: await services.users.getLimits(user.id) });
});

export const PATCH = withErrorHandling('account.limits.update', async (ctx, request: Request) => {
  const { services, user, actor } = await withUser(request, ctx);
  const body = await readJson(request, schema, ctx);
  const limits = await services.users.updateLimits({
    userId: user.id,
    actorId: user.id,
    limits: {
      maxStakePerBetMinor: body.maxStakePerBetMinor === undefined || body.maxStakePerBetMinor === null ? undefined : BigInt(body.maxStakePerBetMinor),
      maxStakePerDayMinor: body.maxStakePerDayMinor === undefined || body.maxStakePerDayMinor === null ? undefined : BigInt(body.maxStakePerDayMinor),
      lossLimitDailyMinor: body.lossLimitDailyMinor === undefined || body.lossLimitDailyMinor === null ? undefined : BigInt(body.lossLimitDailyMinor),
      lossLimitWeeklyMinor: body.lossLimitWeeklyMinor === undefined || body.lossLimitWeeklyMinor === null ? undefined : BigInt(body.lossLimitWeeklyMinor),
      depositLimitDailyMinor: body.depositLimitDailyMinor === undefined || body.depositLimitDailyMinor === null ? undefined : BigInt(body.depositLimitDailyMinor),
      depositLimitWeeklyMinor: body.depositLimitWeeklyMinor === undefined || body.depositLimitWeeklyMinor === null ? undefined : BigInt(body.depositLimitWeeklyMinor),
      sessionLimitMinutes: body.sessionLimitMinutes ?? undefined,
    },
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'limits.updated', entityType: 'user_limits', entityId: user.id,
    after: body, reason: 'customer self-service limits', correlationId: actor.correlationId,
  });
  return jsonOk({ limits });
});
