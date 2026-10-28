import { convertAdminAmountToUsd, getAdminUsdRates, addAdminUsdAmounts } from '@/server/utils/admin-usd';
import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withUser, withAdmin } from '@/server/http/guard';
import { requireAdmin } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  action: z.enum(['set_status', 'set_parent', 'update_terms', 'adjust']),
  status: z.enum(['pending', 'approved', 'suspended', 'blocked', 'closed']).optional(),
  parentAffiliateId: z.string().uuid().nullable().optional(),
  model: z.enum(['PROFIT_LOSS_35', 'NON_NEGATIVE_35', 'CPA', 'HYBRID']).optional(),
  rateBps: z.number().int().min(0).max(10_000).optional(),
  minPayoutMinor: z.string().regex(/^\d{1,19}$/).optional(),
  amountMinor: z.string().regex(/^-?\d{1,19}$/).optional(),
  reason: z.string().min(8).max(400),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export const GET = withErrorHandling('admin.affiliates.get', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services } = await withAdmin(request, ctx, 'affiliates.view');
  const affiliate = await services.affiliate.getById(id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
  const [payable, stats, ledger, payouts, fraud, referrals, hierarchy] = await Promise.all([
    services.affiliate.payableBalance(id),
    services.affiliate.getStats(id, { start: new Date(Date.now() - 30 * 864e5).toISOString(), end: new Date().toISOString() }),
    services.affiliate.listLedger(id, { page: 1, pageSize: 20 }),
    services.affiliate.listPayouts({ affiliateId: id, page: 1, pageSize: 20 }),
    services.affiliate.fraudSignals(id),
    services.affiliate.listAdminReferralBuckets(id, { page: 1, pageSize: 20 }),
    services.affiliate.hierarchy(id),
  ]);
  const currencies = [
    affiliate.currency,
    ...referrals.items.map((row) => row.currency),
    ...ledger.items.map((row) => row.currency),
    ...payouts.items.map((row) => row.currency),
  ];
  const rates = await getAdminUsdRates(currencies);
  const usd = (amount: bigint, currency: string) =>
    convertAdminAmountToUsd(amount, currency, rates)?.toString() ?? null;

  const projectedAffiliate = {
    ...affiliate,
    usdMinPayoutMinor: usd(affiliate.minPayoutMinor, affiliate.currency),
    usdLifetimeCommissionMinor: usd(affiliate.lifetimeCommissionMinor, affiliate.currency),
    usdLifetimePaidMinor: usd(affiliate.lifetimePaidMinor, affiliate.currency),
    usdLifetimeDepositsMinor: usd(affiliate.lifetimeDepositsMinor, affiliate.currency),
  };

  const projectedPayable = {
    ...payable,
    currency: affiliate.currency,
    usdPayableMinor: usd(payable.payableMinor, affiliate.currency),
    usdRawMinor: usd(payable.rawMinor, affiliate.currency),
    usdCarryForwardMinor: usd(payable.carryForwardMinor, affiliate.currency),
    usdSuppressedMinor: usd(payable.suppressedMinor, affiliate.currency),
  };

  const projectedLedger = {
    ...ledger,
    items: ledger.items.map((row) => ({
      ...row,
      usdAmountMinor: usd(row.amountMinor, row.currency),
      usdBalanceAfterMinor:
        row.balanceAfterMinor == null ? null : usd(row.balanceAfterMinor, row.currency),
    })),
  };

  const projectedPayouts = {
    ...payouts,
    items: payouts.items.map((row) => ({
      ...row,
      usdAmountMinor: usd(row.amountMinor, row.currency),
      usdPayableAtRequestMinor:
        row.payableAtRequestMinor == null ? null : usd(row.payableAtRequestMinor, row.currency),
    })),
  };

  const referralMap = new Map<string, {
    userId: string; code: string; status: string; confirmedAt: string | null;
    usdWageredMinor: bigint | null; usdNetRevenueMinor: bigint | null; usdCommissionMinor: bigint | null;
    usdDepositMinor: bigint | null; usdWithdrawalMinor: bigint | null; usdPanelShareMinor: bigint | null;
  }>();

  for (const row of referrals.items) {
    const c = {
      wagered: convertAdminAmountToUsd(row.wageredMinor, row.currency, rates),
      netRevenue: convertAdminAmountToUsd(row.netRevenueMinor, row.currency, rates),
      commission: convertAdminAmountToUsd(row.commissionMinor, row.currency, rates),
      deposit: convertAdminAmountToUsd(row.depositMinor, row.currency, rates),
      withdrawal: convertAdminAmountToUsd(row.withdrawalMinor, row.currency, rates),
      panelShare: convertAdminAmountToUsd(row.panelShareMinor, row.currency, rates),
    };
    const old = referralMap.get(row.userId);
    if (old) {
      old.usdWageredMinor = addAdminUsdAmounts(old.usdWageredMinor, c.wagered);
      old.usdNetRevenueMinor = addAdminUsdAmounts(old.usdNetRevenueMinor, c.netRevenue);
      old.usdCommissionMinor = addAdminUsdAmounts(old.usdCommissionMinor, c.commission);
      old.usdDepositMinor = addAdminUsdAmounts(old.usdDepositMinor, c.deposit);
      old.usdWithdrawalMinor = addAdminUsdAmounts(old.usdWithdrawalMinor, c.withdrawal);
      old.usdPanelShareMinor = addAdminUsdAmounts(old.usdPanelShareMinor, c.panelShare);
    } else {
      referralMap.set(row.userId, {
        userId: row.userId, code: row.code, status: row.status, confirmedAt: row.confirmedAt,
        usdWageredMinor: c.wagered, usdNetRevenueMinor: c.netRevenue,
        usdCommissionMinor: c.commission, usdDepositMinor: c.deposit,
        usdWithdrawalMinor: c.withdrawal, usdPanelShareMinor: c.panelShare,
      });
    }
  }

  const projectedReferrals = {
    ...referrals,
    items: Array.from(referralMap.values()).map((row) => ({
      userId: row.userId, code: row.code, status: row.status, confirmedAt: row.confirmedAt,
      usdWageredMinor: row.usdWageredMinor?.toString() ?? null,
      usdNetRevenueMinor: row.usdNetRevenueMinor?.toString() ?? null,
      usdCommissionMinor: row.usdCommissionMinor?.toString() ?? null,
      usdDepositMinor: row.usdDepositMinor?.toString() ?? null,
      usdWithdrawalMinor: row.usdWithdrawalMinor?.toString() ?? null,
      usdPanelShareMinor: row.usdPanelShareMinor?.toString() ?? null,
    })),
  };

  return jsonOk({
    affiliate: projectedAffiliate,
    payable: projectedPayable,
    stats,
    ledger: projectedLedger,
    payouts: projectedPayouts,
    fraud,
    referrals: projectedReferrals,
    hierarchy,
  });
});

export const PATCH = withErrorHandling('admin.affiliates.patch', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  // Session first, payload second, permission third (the required permission depends on the action).
  const { services, user, actor } = await withUser(request, ctx);
  const body = await readJson(request, patchSchema, ctx);
  const permission = body.action === 'set_status' ? 'affiliates.approve' : 'affiliates.edit';
  requireAdmin(user, permission);
  switch (body.action) {
    case 'set_status': {
      if (!body.status) throw new ApiError('VALIDATION_FAILED', 'status is required');
      const affiliate = await services.affiliate.setStatus({ affiliateId: id, status: body.status, actorId: user.id, reason: body.reason });
      return jsonOk({ affiliate });
    }
    case 'set_parent': {
      const affiliate = await services.affiliate.setParent({ affiliateId: id, parentAffiliateId: body.parentAffiliateId ?? null, actorId: user.id });
      return jsonOk({ affiliate });
    }
    case 'update_terms': {
      const affiliate = await services.affiliate.update({
        affiliateId: id, actorId: user.id,
        patch: {
          ...(body.model ? { commissionModel: body.model } : {}),
          ...(body.rateBps !== undefined ? { commissionRateBps: body.rateBps } : {}),
          ...(body.minPayoutMinor ? { minPayoutMinor: BigInt(body.minPayoutMinor) } : {}),
        },
      });
      return jsonOk({ affiliate });
    }
    case 'adjust': {
      if (!body.amountMinor) throw new ApiError('VALIDATION_FAILED', 'amountMinor is required');
      const result = await services.affiliate.adjust({
        affiliateId: id, amountMinor: body.amountMinor, reason: body.reason, actorId: user.id,
        idempotencyKey: body.idempotencyKey ?? `adj:${id}:${Date.now()}`,
      });
      await services.admin.writeAudit({
        actorId: user.id, action: 'affiliate.adjusted', entityType: 'affiliate', entityId: id,
        after: { amountMinor: body.amountMinor }, reason: body.reason, correlationId: actor.correlationId,
      });
      return jsonOk({ adjustment: { ...result, payableMinor: result.payableMinor.toString() } });
    }
    default:
      throw new ApiError('VALIDATION_FAILED', 'Unsupported action');
  }
});
