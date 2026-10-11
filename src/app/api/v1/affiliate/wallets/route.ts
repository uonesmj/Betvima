import { z } from 'zod';
import { withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAffiliate } from '@/server/http/guard';
import { ApiError } from '@/lib/errors';
import type { AffiliateWalletAsset } from '@/lib/types/affiliate';

export const dynamic = 'force-dynamic';

const assets = ['USDT_TRC20', 'TRX', 'DOGE'] as const;

const schema = z.object({
  asset: z.enum(assets),
  address: z.string().trim().min(34).max(128),
});

function validateAddress(asset: AffiliateWalletAsset, address: string) {
  const value = address.trim();
  const base58 = '[1-9A-HJ-NP-Za-km-z]';

  if (asset === 'USDT_TRC20' || asset === 'TRX') {
    if (!new RegExp(`^T${base58}{33}$`).test(value)) {
      throw new ApiError('BAD_REQUEST', 'Invalid TRON wallet address');
    }
    return;
  }

  if (!new RegExp(`^D${base58}{33}$`).test(value)) {
    throw new ApiError('BAD_REQUEST', 'Invalid DOGE wallet address');
  }
}

function maskAddress(address: string) {
  const value = address.trim();
  if (value.length <= 10) return '****';
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

export const GET = withErrorHandling('affiliate.wallets.list', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');

  const wallets = await services.affiliate.listWallets(affiliate.id);
  const payouts = await services.affiliate.listPayouts({
    affiliateId: affiliate.id,
    page: 1,
    pageSize: 100,
  });

  const HIDE_AFTER_MS = 60 * 60 * 1000;
  const now = Date.now();
  const latestPayoutByAsset = new Map<string, string>();

  for (const payout of payouts.items) {
    if (!payout.payoutAsset || !payout.requestedAt) continue;
    if (!latestPayoutByAsset.has(payout.payoutAsset)) {
      latestPayoutByAsset.set(payout.payoutAsset, payout.requestedAt);
    }
  }

  return jsonOk({
    items: wallets.map((wallet) => {
      const latestPayoutAt = latestPayoutByAsset.get(wallet.asset);
      const payoutMs = latestPayoutAt ? Date.parse(latestPayoutAt) : NaN;
      const walletUpdatedMs = Date.parse(wallet.updatedAt);
      const hasNewerPayout =
        Number.isFinite(payoutMs) &&
        (!Number.isFinite(walletUpdatedMs) || payoutMs >= walletUpdatedMs);
      const addressHidden =
        hasNewerPayout &&
        Number.isFinite(payoutMs) &&
        now - payoutMs >= HIDE_AFTER_MS;

      return {
        id: wallet.id,
        affiliateId: wallet.affiliateId,
        asset: wallet.asset,
        addressMasked: addressHidden
          ? null
          : wallet.addressMasked || maskAddress(wallet.address),
        addressHidden,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      };
    }),
  });
});

export const POST = withErrorHandling('affiliate.wallets.save', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');

  const body = await readJson(request, schema, ctx);
  validateAddress(body.asset, body.address);

  const wallet = await services.affiliate.upsertWallet({
    affiliateId: affiliate.id,
    asset: body.asset,
    address: body.address,
  });

  await services.admin.writeAudit({
    actorId: user.id,
    action: 'affiliate.wallet.updated',
    entityType: 'affiliate_wallet',
    entityId: wallet.id,
    after: { asset: wallet.asset, addressMasked: wallet.addressMasked },
    reason: 'affiliate wallet updated',
    correlationId: ctx.correlationId,
  });

  return jsonCreated({
    wallet: {
      id: wallet.id,
      affiliateId: wallet.affiliateId,
      asset: wallet.asset,
      addressMasked: wallet.addressMasked,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    },
  });
});
