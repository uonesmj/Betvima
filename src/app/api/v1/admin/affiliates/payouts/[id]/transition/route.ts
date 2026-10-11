import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson, idempotencyKeyFrom } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({
  to: z.enum(['approved', 'processing', 'paid', 'rejected', 'cancelled', 'failed']),
  reason: z.string().max(300).optional(),
  providerReference: z.string().max(120).optional(),
  evidenceUrl: z.string().url().max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.to === 'paid' && !value.providerReference?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['providerReference'],
      message: 'Provider reference / TXID is required before marking a payout as paid',
    });
  }
});

/** Payout state machine. `paid` requires a provider reference; dual approval is DB-enforced. */
export const POST = withErrorHandling('admin.affiliate_payouts.transition', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'affiliates.payout');
  void idempotencyKeyFrom(request);
  const body = await readJson(request, schema, ctx);
  const payout = await services.affiliate.transitionPayout({
    payoutId: id, to: body.to, actorId: user.id, reason: body.reason,
    providerReference: body.providerReference, evidenceUrl: body.evidenceUrl,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: `affiliate.payout_${body.to}`, entityType: 'affiliate_payout', entityId: id,
    after: { to: body.to, providerReference: body.providerReference ?? null },
    reason: body.reason ?? `payout ${body.to}`, correlationId: actor.correlationId,
  });
  return jsonOk({ payout });
});
