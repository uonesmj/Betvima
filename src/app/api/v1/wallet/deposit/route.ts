import { z } from 'zod';
import { withErrorHandling, jsonCreated } from '@/lib/errors';
import { readJson, enforceRateLimit, idempotencyKeyFrom } from '@/server/http/request';
import { withUser } from '@/server/http/guard';
import { clientIpFromHeaders } from '@/server/utils/hash';

export const dynamic = 'force-dynamic';

const schema = z.object({
  amountMinor: z.string().regex(/^\d{1,19}$/),
  currency: z.enum(['IRT', 'IRR', 'USD', 'EUR', 'GBP']),
  methodId: z.string().min(1).max(64),
  asset: z.string().trim().min(2).max(32).optional(),
  network: z.string().trim().min(2).max(32).optional(),
  voucherCode: z.string().trim().min(1).max(128).optional(),
});

/**
 * Deposit intent. Without a configured provider this returns PAYMENT_PROVIDER_DISABLED -
 * the platform never invents a successful payment.
 */
export const POST = withErrorHandling('wallet.deposit', async (ctx, request: Request) => {
  const { services, user, actor } = await withUser(request, ctx);
  const idempotencyKey = idempotencyKeyFrom(request);
  await enforceRateLimit(`deposit:${user.id}`, 10, 300);
  const body = await readJson(request, schema, ctx);
  const intent = await services.paymentsService.createDeposit({
    userId: user.id, amountMinor: BigInt(body.amountMinor), currency: body.currency,
    methodId: body.methodId,
    idempotencyKey,
    ip: clientIpFromHeaders(request.headers),
    asset: body.asset,
    network: body.network,
    voucherCode: body.voucherCode,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'payment.deposit_requested', entityType: 'payment_intent', entityId: intent.publicId,
    after: { amountMinor: body.amountMinor, currency: body.currency, method: body.methodId },
    reason: 'customer deposit', correlationId: actor.correlationId,
  });
  return jsonCreated({ intent });
});
