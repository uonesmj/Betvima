import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

const iso = z.string().datetime({ offset: true });

/**
 * Friday settlement for one affiliate. Default period = the previous completed week
 * ending at the configured cutoff in the affiliate's timezone. Idempotent: the weekly
 * key makes a second run a no-op (`duplicate`).
 */
export const POST = withErrorHandling('admin.affiliates.settle', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'affiliates.edit');
  const query = searchParams(request);
  const end = iso.safeParse(query.get('periodEnd')).success ? query.get('periodEnd')! : defaultPeriodEnd();
  const startRaw = query.get('periodStart');
  const start = iso.safeParse(startRaw).success ? startRaw! : new Date(new Date(end).getTime() - 7 * 864e5).toISOString();
  const result = await services.affiliate.settlePeriod({
    affiliateId: id, periodStart: start, periodEnd: end, dryRun: query.get('dryRun') === 'true', actorId: user.id,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'affiliate.settlement_run', entityType: 'affiliate', entityId: id,
    after: result, reason: `period ${start} → ${end}`, correlationId: actor.correlationId,
  });
  return jsonOk({ settlement: serializeSettlement(result) });
});

function serializeSettlement(result: { commissionMinor: bigint; payableMinor: bigint; carryForwardMinor: bigint; suppressedMinor: bigint }) {
  return {
    ...result,
    commissionMinor: result.commissionMinor.toString(),
    payableMinor: result.payableMinor.toString(),
    carryForwardMinor: result.carryForwardMinor.toString(),
    suppressedMinor: result.suppressedMinor.toString(),
  };
}

function defaultPeriodEnd(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysSinceFriday = (day + 2) % 7;
  const friday = new Date(now.getTime() - daysSinceFriday * 864e5);
  friday.setUTCHours(23, 59, 59, 999);
  return friday.toISOString();
}
