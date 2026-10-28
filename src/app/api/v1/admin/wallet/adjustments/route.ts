import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { readJson, idempotencyKeyFrom, intParam, searchParams, enforceRateLimit } from '@/server/http/request';
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
 * One-authority wallet correction for the sole active super administrator.
 * Admin MFA AAL2 is enforced by withAdmin. The existing authoritative wallet
 * posting RPC enforces idempotency, nonnegative balance and ledger integrity;
 * wallet.adminAdjust writes the immutable audit event. No admin-adjustments
 * approval trigger is disabled, and pre-existing pending requests are untouched.
 */
export const POST = withErrorHandling('admin.adjustments.create', async (ctx, request: Request) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'wallet.adjust');
  if (user.role !== 'super_admin') throw new ApiError('FORBIDDEN', 'Only the sole Super Admin can adjust balances');
  const owner = await services.db.queryOne<{ id: string; count: string }>(
    `select min(id::text) as id, count(*)::text as count from nova.profiles
      where role::text = 'super_admin' and status::text = 'active'`,
  );
  const identity = await services.db.queryOne<{ numeric_id: string }>(
    'select numeric_id::text as numeric_id from nova.profiles where id=$1',
    [user.id],
  );
  if (owner?.count !== '1' || owner.id !== user.id || identity?.numeric_id !== '1010') {
    throw new ApiError('FORBIDDEN', 'Exactly one designated active Super Admin is required');
  }
  await enforceRateLimit(`admin:wallet:direct:${user.id}`, 6, 300);
  const idempotencyKey = idempotencyKeyFrom(request);
  const body = await readJson(request, schema, ctx);
  const amount = BigInt(body.amountMinor);
  if (amount <= 0n || amount > 9_223_372_036_854_775_807n) {
    throw new ApiError('VALIDATION_FAILED', 'Amount outside signed 64-bit positive range');
  }
  const target = await services.db.queryOne<{ role: string; status: string }>(
    'select role::text as role, status::text as status from nova.profiles where id = $1',
    [body.userId],
  );
  if (!target || !['user','affiliate'].includes(target.role) || target.status !== 'active')
    throw new ApiError('FORBIDDEN', 'Only active player wallets may be adjusted');
  const adjustment = await services.wallet.adminAdjust({
    userId: body.userId, amountMinor: body.amountMinor, currency: body.currency,
    direction: body.direction, type: body.type, reason: body.reason,
    notes: body.notes, actorId: user.id, idempotencyKey,
  });
  // adminAdjust already writes wallet ledger + audit_event; this secondary
  // record allows the existing admin audit UI to trace the operator action.
  await services.admin.writeAudit({
    actorId: user.id, action: 'wallet.adjustment_applied_by_sole_super_admin',
    entityType: 'wallet_transaction', entityId: adjustment.id,
    after: { userId: body.userId, amountMinor: body.amountMinor, currency: body.currency,
      direction: body.direction, type: body.type, walletEntryId: adjustment.walletEntryId },
    reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonCreated({ adjustment });
});
