import type { Db } from '@/lib/ports/db';
import type { BonusRepository } from '@/lib/ports/repositories';
import type { BonusGrant, BonusListResult, BonusPromotionSummary, BonusStatus, Currency, UUID } from '@/lib/types';
import { type Row, toBig, toIso, toIsoOrNull, toNum, toStr, toStrOrNull } from '@/server/db/rows';

function mapBonus(row: Row): BonusGrant {
  return {
    id: toStr(row.id),
    userId: toStr(row.user_id),
    promotionId: toStrOrNull(row.promotion_id),
    promotionKey: toStrOrNull(row.promotion_code),
    title: toStr(row.promotion_title, '100% Deposit Bonus'),
    description: toStrOrNull(row.promotion_description),
    currency: toStr(row.currency, 'USD') as Currency,
    amountMinor: toBig(row.amount_minor),
    remainingAmountMinor: toBig(row.remaining_amount_minor),
    status: toStr(row.status, 'active') as BonusStatus,
    grantedAt: toIso(row.granted_at),
    expiresAt: toIso(row.expires_at),
    lockedAt: toIsoOrNull(row.locked_at),
    usedAt: toIsoOrNull(row.used_at),
    betId: toStrOrNull(row.bet_id),
    depositPaymentTransactionId: toStr(row.deposit_payment_transaction_id),
  };
}

export class PostgresBonusRepository implements BonusRepository {
  constructor(readonly db: Db) {}

  async listGrants(userId: UUID, filter: {
    currency?: Currency;
    status?: BonusStatus;
    page?: number;
    pageSize?: number;
  }): Promise<BonusListResult> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 100));
    const currency = filter.currency ?? null;
    const status = filter.status ?? null;

    // Expiry is authoritative in the database. The function is idempotent and
    // only transitions active grants whose 24-hour expiry has passed.
    await this.db.rpc('expire_bonus_grants');

    const params = [
      userId,
      currency,
      status,
      pageSize,
      (page - 1) * pageSize,
    ];

    const where = `
      where bg.user_id = $1
        and ($2::text is null or bg.currency::text = $2::text)
        and ($3::text is null or bg.status::text = $3::text)
    `;

    const rows = await this.db.query<Row>(
      `select
         bg.*,
         p.slug as promotion_code,
         p.title as promotion_title,
         p.description as promotion_description
       from nova.bonus_grants bg
       left join nova.promotions p on p.id = bg.promotion_id
       ${where}
       order by bg.granted_at desc, bg.id desc
       limit $4 offset $5`,
      params,
    );

    const count = await this.db.queryOne<Row>(
      `select count(*) as total
       from nova.bonus_grants bg
       ${where}`,
      params.slice(0, 3),
    );

    const summaryRow = await this.db.queryOne<Row>(
      `select
         count(*)::bigint as total,
         count(*) filter (where status = 'active')::bigint as active,
         count(*) filter (where status = 'locked')::bigint as locked,
         count(*) filter (where status = 'won')::bigint as won,
         count(*) filter (where status = 'lost')::bigint as lost,
         count(*) filter (where status = 'expired')::bigint as expired,
         count(*) filter (where status = 'cancelled')::bigint as cancelled,
         coalesce(sum(amount_minor) filter (where status = 'active'), 0) as active_amount_minor,
         coalesce(sum(amount_minor) filter (where status = 'locked'), 0) as locked_amount_minor
       from nova.bonus_grants
       where user_id = $1
         and ($2::text is null or currency::text = $2::text)`,
      [userId, currency],
    );

    const items = rows.map(mapBonus);
    const total = toNum(count?.total);

    let promotion: BonusPromotionSummary | null = null;
    const promotionId = items.find((item) => item.promotionId)?.promotionId ?? null;
    if (promotionId) {
      const p = await this.db.queryOne<Row>(
        `select id, slug as code, type, title, description, percentage_bps,
                min_deposit_minor, max_bonus_minor, is_active
           from nova.promotions
          where id = $1
          limit 1`,
        [promotionId],
      );
      if (p) {
        promotion = {
          id: toStr(p.id),
          code: toStr(p.code),
          type: toStr(p.type),
          title: toStr(p.title),
          description: toStrOrNull(p.description),
          percentageBps: toNum(p.percentage_bps),
          minDepositMinor: p.min_deposit_minor == null ? null : toBig(p.min_deposit_minor),
          maxBonusMinor: p.max_bonus_minor == null ? null : toBig(p.max_bonus_minor),
          isActive: Boolean(p.is_active),
        };
      }
    }

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      summary: {
        total: toNum(summaryRow?.total),
        active: toNum(summaryRow?.active),
        locked: toNum(summaryRow?.locked),
        won: toNum(summaryRow?.won),
        lost: toNum(summaryRow?.lost),
        expired: toNum(summaryRow?.expired),
        cancelled: toNum(summaryRow?.cancelled),
        activeAmountMinor: toBig(summaryRow?.active_amount_minor),
        lockedAmountMinor: toBig(summaryRow?.locked_amount_minor),
      },
      promotion,
    };
  }
}
