import { z } from 'zod';
import { withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { readJson, idempotencyKeyFrom, intParam, searchParams } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';
import { convertAdminAmountToUsd, getAdminUsdRates } from '@/server/utils/admin-usd';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.adjustments.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'wallet.view');
  const params = searchParams(request);
  const page = await services.wallet.listAdminAdjustments({
    status: params.get('status') ?? undefined,
    page: intParam(params, 'page', 1, 5000), pageSize: intParam(params, 'pageSize', 25, 100),
  });
  const rates = await getAdminUsdRates(page.items.map((row) => row.currency));
  return jsonOk({ ...page, items: page.items.map((row) => ({ ...row, usdAmountMinor: convertAdminAmountToUsd(row.amountMinor, row.currency, rates)?.toString() ?? null })) });
});

const schema = z.object({
  userId: z.string().uuid(),
  amountMinor: z.string().regex(/^\d{1,19}$/),
  currency: z.enum(['IRT', 'IRR', 'USD', 'EUR', 'GBP']),
  direction: z.enum(['credit', 'debit']),
  type: z.string().min(2).max(40),
  reason: z.string().min(8).max(500),
  notes: z.string().max(2000).optional(),
});

/**
 * Wallet adjustment REQUEST. Money only moves when a second authorised operator
 * approves it (dual control, enforced by a database trigger).
 */
export const POST = withErrorHandling('admin.adjustments.create', async (ctx, request: Request) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'wallet.adjust');
  const idempotencyKey = idempotencyKeyFrom(request);
  const body = await readJson(request, schema, ctx);
  const adjustment = await services.wallet.requestAdminAdjustment({
    userId: body.userId, amountMinor: body.amountMinor, currency: body.currency, direction: body.direction,
    type: body.type, reason: body.reason, notes: body.notes, actorId: user.id, idempotencyKey,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'wallet.adjustment_requested', entityType: 'admin_adjustment', entityId: adjustment.id,
    after: body, reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonCreated({ adjustment });
});
