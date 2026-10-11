import type { Db } from '@/lib/ports/db';
import { lastWeeklyCutoff } from '@/domain/time';
import type {
  AffiliateFilter, AffiliateRegistration, AffiliateRepository, AffiliateWalletAsset, AffiliateWallet, AffiliateSettlementResult, AttributionInput,
  ReferralClickInput,
} from '@/lib/ports/repositories';
import type {
  Affiliate, AffiliateLedgerEntry, AffiliatePayout, AffiliateStats, AttributionRecord, Bps, CommissionModel,
  Currency, FraudSignalResult, Paginated, UUID,
} from '@/lib/types';
import { ApiError } from '@/lib/errors';
import { hashSignal } from '@/server/utils/hash';
import { type Row, toBig, toBigOrNull, toBool, toIso, toIsoOrNull, toNum, toStr, toStrOrNull } from '@/server/db/rows';

function mapAffiliate(row: Row, payable = 0n, raw = 0n, carry = 0n, suppressed = 0n): Affiliate {
  const created = toIso(row.created_at);
  return {
    id: toStr(row.id), publicId: toStr(row.public_id), userId: toStrOrNull(row.user_id), code: toStr(row.code),
    status: toStr(row.status, 'pending') as Affiliate['status'], displayName: toStr(row.display_name, toStr(row.code)),
    email: toStrOrNull(row.email), phone: toStrOrNull(row.phone),
    parentAffiliateId: toStrOrNull(row.parent_affiliate_id), depth: toNum(row.depth),
    path: null, commissionModel: toStr(row.commission_model, 'NON_NEGATIVE_35') as CommissionModel,
    commissionRateBps: toNum(row.commission_rate_bps, 3500) as Bps, parentOverrideBps: toNum(row.parent_override_bps) as Bps,
    currency: toStr(row.currency, 'IRT') as Currency, minPayoutMinor: toBig(row.min_payout_minor, 5_000_000n),
    settlementTimezone: toStr(row.settlement_timezone, 'Asia/Tehran'), settlementDay: toNum(row.settlement_day_iso, 5),
    settlementHour: toNum(row.settlement_hour, 3), settlementMinute: toNum(row.settlement_minute, 0),
    payableMinor: payable, carryForwardMinor: carry, suppressedMinor: suppressed,
    lifetimeCommissionMinor: toBig(row.lifetime_commission_minor), lifetimePaidMinor: toBig(row.lifetime_paid_minor),
    lifetimeDepositsMinor: toBig(row.lifetime_deposits_minor),
    tier: null, riskScore: toNum(row.risk_score), isFraudFlagged: toNum(row.open_flags) > 0,
    approvedAt: toIsoOrNull(row.approved_at), approvedBy: null, createdAt: created, updatedAt: toIso(row.updated_at),
  };
}

function mapLedger(row: Row): AffiliateLedgerEntry {
  return {
    id: toStr(row.id), affiliateId: toStr(row.affiliate_id), currency: toStr(row.currency, 'IRT') as Currency,
    type: toStr(row.type) as AffiliateLedgerEntry['type'], amountMinor: toBig(row.amount_minor),
    balanceAfterMinor: toBig(row.balance_after_minor),
    sourceUserId: toStrOrNull(row.user_id), betId: toStrOrNull(row.bet_id), settlementId: toStrOrNull(row.settlement_id),
    payoutId: toStrOrNull(row.payout_id), periodStart: null, periodEnd: toIsoOrNull(row.settled_at),
    description: toStrOrNull(row.reason), idempotencyKey: toStr(row.idempotency_key), createdAt: toIso(row.created_at),
  };
}

function mapPayout(row: Row): AffiliatePayout {
  const requestedBy = toStrOrNull(row.requested_by);
  return {
    id: toStr(row.id), publicId: toStr(row.public_id), affiliateId: toStr(row.affiliate_id),
    status: toStr(row.status, 'requested') as AffiliatePayout['status'], currency: toStr(row.currency, 'IRT') as Currency,
    amountMinor: toBig(row.amount_minor), payableAtRequestMinor: toBig(row.amount_minor),
    method: toStrOrNull(row.method), destinationMasked: toStrOrNull(row.destination_masked),
    payoutAsset: toStrOrNull(row.payout_asset) as AffiliatePayout['payoutAsset'], destinationAddress: toStrOrNull(row.destination_address),
    periodStart: null, periodEnd: null,
    requestedBy, requestedAt: toIsoOrNull(row.requested_at), approvedBy: toStrOrNull(row.approved_by),
    approvedAt: toIsoOrNull(row.approved_at), paidBy: toStrOrNull(row.paid_by), paidAt: toIsoOrNull(row.paid_at),
    rejectedBy: toStrOrNull(row.rejected_by), rejectedAt: toIsoOrNull(row.rejected_at),
    rejectionReason: toStrOrNull(row.failed_reason), providerReference: toStrOrNull(row.provider_reference),
    evidenceUrl: null, idempotencyKey: toStr(row.idempotency_key),
    createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at),
  };
}

export class PostgresAffiliateRepository implements AffiliateRepository {
  constructor(readonly db: Db) {}

  private readonly AFFILIATE_COLUMNS = `
    a.*, p.email, p.phone,
    (select count(*) from nova.affiliate_fraud_flags f where f.affiliate_id = a.id and f.status = 'open') as open_flags,
    (select max(case f.severity when 'critical' then 90 when 'high' then 70 when 'medium' then 50 when 'low' then 25 else 10 end)
                from nova.affiliate_fraud_flags f where f.affiliate_id = a.id) as risk_score,
    coalesce((select sum(l.amount_minor) from nova.affiliate_ledger l where l.affiliate_id = a.id and l.type in ('user_loss_commission','adjustment','carry_forward_release')),0) as lifetime_commission_minor,
    coalesce((select sum(l.amount_minor) from nova.affiliate_ledger l where l.affiliate_id = a.id and l.type = 'payout'),0) as lifetime_paid_minor,
    coalesce((select sum(t.amount_minor) from nova.wallet_transactions t join nova.affiliate_attributions at on at.user_id = t.user_id
               where at.affiliate_id = a.id and t.type = 'deposit'),0) as lifetime_deposits_minor`;

  private async payableOf(affiliateId: UUID) {
    const row = await this.db.queryOne<Row>(`select * from nova.affiliate_payable_balance($1)`, [affiliateId]);
    return {
      payable: toBig(row?.payable_minor), raw: toBig(row?.raw_minor),
      carry: toBigOrNull(row?.carry_forward_minor) ?? 0n, suppressed: toBig(row?.suppressed_minor),
      floorApplied: toBool(row?.floor_applied),
    };
  }

  async getByCode(code: string): Promise<Affiliate | null> {
    const row = await this.db.queryOne<Row>(
      `select ${this.AFFILIATE_COLUMNS}
         from nova.affiliates a
         left join nova.profiles p on p.id = a.user_id
        where upper(a.code) = upper($1)
           or lower(a.slug) = lower($1)
           or exists (
             select 1
               from nova.affiliate_links l
              where l.affiliate_id = a.id
                and upper(l.code) = upper($1)
                and l.is_active = true
           )
        limit 1`,
      [code],
    );
    if (!row) return null;
    const balance = await this.payableOf(toStr(row.id));
    return mapAffiliate(row, balance.payable, balance.raw, balance.carry, balance.suppressed);
  }
  async getById(id: UUID): Promise<Affiliate | null> {
    const row = await this.db.queryOne<Row>(
      `select ${this.AFFILIATE_COLUMNS} from nova.affiliates a left join nova.profiles p on p.id = a.user_id where a.id = $1`, [id],
    );
    if (!row) return null;
    const balance = await this.payableOf(id);
    return mapAffiliate(row, balance.payable, balance.raw, balance.carry, balance.suppressed);
  }

  async getByUserId(userId: UUID): Promise<Affiliate | null> {
    const row = await this.db.queryOne<Row>(`select id from nova.affiliates where user_id = $1`, [userId]);
    return row ? this.getById(toStr(row.id)) : null;
  }

  /**
   * Registration goes through `nova.register_affiliate`, which is the only place allowed
   * to create an affiliate row and set `profiles.is_affiliate` (both guarded by RLS).
   */
  async register(input: AffiliateRegistration): Promise<Affiliate> {
    return this.db.transaction(async (tx) => {
      await tx.query(`select set_config('nova.user_id', $1, true)`, [input.userId]);
      if (input.username) await tx.rpc('prepare_affiliate_profile', { p_user_id: input.userId, p_username: input.username });
      const result = await tx.rpc<Record<string, unknown>>('register_affiliate', {
        p_user_id: input.userId, p_code: input.code, p_display_name: input.displayName,
        p_model: input.model ?? 'PROFIT_LOSS_35', p_rate_bps: input.rateBps ?? 7000,
        p_parent_code: input.parentCode ?? null, p_currency: 'USD', p_min_payout: 4000,
      });
      await tx.query(
        `insert into nova.affiliate_commission_configs (
           scope, scope_ref, commission_model, commission_rate_bps, allow_negative_balance,
           negative_balance_floor_minor, min_payout_minor, carry_forward,
           settlement_day_iso, settlement_time, settlement_timezone, auto_payout,
           priority, is_active, effective_from, reason
         ) values (
           'AFFILIATE', $1, $2::nova.commission_model, $3, true, 0, 4000, true,
           5, '03:00'::time, 'Asia/Tehran', false, 10, true, now(),
           'self-service affiliate default 70% USD profit/loss'
         )`,
        [toStr(result.affiliate_id), input.model ?? 'PROFIT_LOSS_35', input.rateBps ?? 7000],
      );
      if (input.email || input.phone) {
        await tx.query(
          `update nova.profiles set email = coalesce(email, $2), phone = coalesce(phone, $3) where id = $1`,
          [input.userId, input.email ?? null, input.phone ?? null],
        );
      }
      if (input.email && input.accountNumber) {
        await tx.query(
          `insert into nova.affiliate_payout_profiles
             (affiliate_id, full_name, email, account_number, payout_method, currency)
           values ($1, $2, $3, $4, 'bank_transfer', 'USD')
           on conflict (affiliate_id) do update
             set full_name = excluded.full_name,
                 email = excluded.email,
                 account_number = excluded.account_number,
                 updated_at = now()`,
          [toStr(result.affiliate_id), input.displayName, input.email, input.accountNumber],
        );
      }
      const affiliate = await new PostgresAffiliateRepository(tx).getById(toStr(result.affiliate_id));
      if (!affiliate) throw new ApiError('INTERNAL_ERROR', 'Affiliate was created but could not be read back');
      return affiliate;
    });
  }
  async setStatus(input: { affiliateId: UUID; status: string; actorId: UUID; reason: string }): Promise<Affiliate> {
    await this.db.rpc('set_affiliate_status', {
      p_affiliate_id: input.affiliateId, p_status: input.status, p_actor: input.actorId, p_reason: input.reason,
    });
    const affiliate = await this.getById(input.affiliateId);
    if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
    return affiliate;
  }

  async update(input: { affiliateId: UUID; patch: Partial<Affiliate>; actorId: UUID }): Promise<Affiliate> {
    const before = await this.db.queryOne<Row>(`select * from nova.affiliates where id = $1`, [input.affiliateId]);
    if (!before) throw new ApiError('AFFILIATE_NOT_FOUND');
    const patch = input.patch;
    await this.db.query(
      `update nova.affiliates set
          display_name = coalesce($2, display_name),
          status = coalesce($3, status),
          commission_model = coalesce($4, commission_model),
          commission_rate_bps = coalesce($5, commission_rate_bps),
          parent_override_bps = coalesce($6, parent_override_bps),
          min_payout_minor = coalesce($7, min_payout_minor),
          settlement_day_iso = coalesce($8, settlement_day_iso),
          settlement_timezone = coalesce($9, settlement_timezone)
        where id = $1`,
      [input.affiliateId, patch.displayName ?? null, patch.status ?? null, patch.commissionModel ?? null,
        patch.commissionRateBps ?? null, patch.parentOverrideBps ?? null,
        patch.minPayoutMinor === undefined ? null : patch.minPayoutMinor.toString(),
        patch.settlementDay ?? null, patch.settlementTimezone ?? null],
    );
    if (patch.commissionRateBps !== undefined || patch.commissionModel !== undefined) {
      const current = await this.db.queryOne<Row>(
        `select commission_model, commission_rate_bps, min_payout_minor
           from nova.affiliates where id = $1`,
        [input.affiliateId],
      );
      if (current) {
        await this.db.query(
          `update nova.affiliate_commission_configs
              set is_active = false, effective_to = now(), updated_at = now()
            where scope = 'AFFILIATE'
              and scope_ref = $1
              and is_active = true`,
          [input.affiliateId],
        );
        await this.db.query(
          `insert into nova.affiliate_commission_configs (
             scope, scope_ref, commission_model, commission_rate_bps,
             allow_negative_balance, negative_balance_floor_minor,
             min_payout_minor, carry_forward, settlement_day_iso,
             settlement_time, settlement_timezone, auto_payout,
             priority, is_active, effective_from, reason
           ) values (
             'AFFILIATE', $1, $2::nova.commission_model, $3,
             true, 0, 4000, true, 5, '03:00'::time,
             'Asia/Tehran', false, 10, true, now(), 'admin panel terms update'
           )`,
          [input.affiliateId, toStr(current.commission_model), toNum(current.commission_rate_bps, 7000)],
        );
      }
    }
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: 'affiliate.update', p_target_type: 'affiliate', p_target_id: input.affiliateId,
      p_before: before, p_after: patch as Row, p_reason: 'admin update', p_correlation_id: null,
    });
    const after = await this.getById(input.affiliateId);
    if (!after) throw new ApiError('AFFILIATE_NOT_FOUND');
    return after;
  }

  async setParent(input: { affiliateId: UUID; parentAffiliateId: UUID | null; actorId: UUID }): Promise<Affiliate> {
    await this.db.rpc('set_affiliate_parent', {
      p_child_id: input.affiliateId, p_parent_id: input.parentAffiliateId, p_reason: `admin:${input.actorId}`,
    });
    const affiliate = await this.getById(input.affiliateId);
    if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
    return affiliate;
  }

  async listForAdmin(filter: AffiliateFilter): Promise<Paginated<Affiliate>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
    const params = [
      filter.search ?? null, filter.status ?? null, filter.parentAffiliateId ?? null, filter.model ?? null,
      filter.flaggedOnly ?? false, pageSize, (page - 1) * pageSize,
    ];
    const where = `
      where ($1::text is null or a.code ilike '%' || $1 || '%' or a.display_name ilike '%' || $1 || '%' or p.email ilike '%' || $1 || '%')
        and ($2::text is null or a.status::text = $2)
        and ($3::uuid is null or a.parent_affiliate_id = $3)
        and ($4::text is null or a.commission_model::text = $4)
        and (not $5::boolean or exists (select 1 from nova.affiliate_fraud_flags f where f.affiliate_id = a.id and f.status = 'open'))`;
    const rows = await this.db.query<Row>(
      `select ${this.AFFILIATE_COLUMNS} from nova.affiliates a left join nova.profiles p on p.id = a.user_id
       ${where} order by a.created_at desc limit $6 offset $7`, params,
    );
    const count = await this.db.queryOne<Row>(
      `select count(*) as total from nova.affiliates a left join nova.profiles p on p.id = a.user_id ${where}`, params.slice(0, 5),
    );
    const total = toNum(count?.total);
    return { items: rows.map((r) => mapAffiliate(r)), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async listLedger(affiliateId: UUID, filter: { from?: string; to?: string; type?: string; page?: number; pageSize?: number }): Promise<Paginated<AffiliateLedgerEntry>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
    const params = [affiliateId, filter.type ?? null, filter.from ?? null, filter.to ?? null, pageSize, (page - 1) * pageSize];
    const rows = await this.db.query<Row>(
      `select l.*, l.settled_at as period_end_alias from nova.affiliate_ledger l
        where l.affiliate_id = $1 and ($2::text is null or l.type::text = $2)
          and ($3::timestamptz is null or l.created_at >= $3) and ($4::timestamptz is null or l.created_at <= $4)
        order by l.created_at desc limit $5 offset $6`, params,
    );
    const count = await this.db.queryOne<Row>(
      `select count(*) as total from nova.affiliate_ledger where affiliate_id = $1 and ($2::text is null or type::text = $2)
        and ($3::timestamptz is null or created_at >= $3) and ($4::timestamptz is null or created_at <= $4)`, params.slice(0, 4),
    );
    const total = toNum(count?.total);
    return { items: rows.map(mapLedger), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async getStats(affiliateId: UUID, period: { start: string; end: string }): Promise<AffiliateStats> {
    const affiliate = await this.getById(affiliateId);
    if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
    const stats = await this.db.queryOne<Row>(
      `select
         count(distinct at.user_id) as referred,
         coalesce(sum(b.stake_minor),0) as wagered_minor,
         coalesce(sum(b.payout_minor - b.stake_minor),0) as net_revenue_minor,
         count(*) filter (where b.status = 'accepted') as open_bets,
         count(*) filter (where b.status in ('settled','void','partially_settled','cashed_out')) as settled_bets
        from nova.affiliate_attributions at
        left join nova.bets b on b.user_id = at.user_id and b.placed_at between $2 and $3
       where at.affiliate_id = $1`,
      [affiliateId, period.start, period.end],
    );
    const panel = await this.db.queryOne<Row>(
      `select
         coalesce((
           select sum(pt.amount_minor)
           from nova.payment_transactions pt
           where pt.user_id in (
             select distinct a2.user_id
             from nova.affiliate_attributions a2
             where a2.affiliate_id = $1
           )
           and pt.type = 'deposit'
           and pt.status = 'succeeded'
           and pt.completed_at >= $2
           and pt.completed_at < $3
         ),0) as total_deposit_minor,
         coalesce((
           select sum(b2.payout_minor - b2.stake_minor)
           from nova.bets b2
           where b2.user_id in (
             select distinct a3.user_id
             from nova.affiliate_attributions a3
             where a3.affiliate_id = $1
           )
           and b2.status in ('settled','partially_settled','cashed_out')
           and b2.placed_at >= $2
           and b2.placed_at < $3
         ),0) as player_net_result_minor,
         coalesce((
           select sum(pt2.amount_minor)
           from nova.payment_transactions pt2
           where pt2.user_id in (
             select distinct a4.user_id
             from nova.affiliate_attributions a4
             where a4.affiliate_id = $1
           )
           and pt2.type = 'withdrawal'
           and pt2.status = 'succeeded'
           and pt2.completed_at >= $2
           and pt2.completed_at < $3
         ),0) as total_withdrawal_minor`,
      [affiliateId, period.start, period.end],
    );
    const funnel = await this.db.queryOne<Row>(`select
         (select count(*) from nova.affiliate_clicks c where c.affiliate_id = $1 and c.created_at >= $2 and c.created_at < $3) as clicks,
         (select count(distinct a.user_id) from nova.affiliate_attributions a where a.affiliate_id = $1 and a.created_at >= $2 and a.created_at < $3) as registrations,
         (select count(*) from nova.affiliate_attributions a where a.affiliate_id = $1 and a.activated_at >= $2 and a.activated_at < $3) as active_users,
         (select count(distinct a.user_id) from nova.affiliate_attributions a where a.affiliate_id = $1 and exists (select 1 from nova.payment_transactions p where p.user_id = a.user_id and p.type = 'deposit' and p.status = 'succeeded' and p.completed_at >= $2 and p.completed_at < $3 and p.completed_at = (select min(p2.completed_at) from nova.payment_transactions p2 where p2.user_id = a.user_id and p2.type = 'deposit' and p2.status = 'succeeded'))) as first_deposits,
         (select count(distinct a.user_id) from nova.affiliate_attributions a join nova.payment_transactions p on p.user_id = a.user_id where a.affiliate_id = $1 and p.type = 'withdrawal' and p.status = 'succeeded' and p.completed_at >= $2 and p.completed_at < $3) as withdrawals`,
      [affiliateId, period.start, period.end],
    );
    const commission = await this.db.queryOne<Row>(
      `select coalesce(sum(amount_minor) filter (where type in ('user_loss_commission','adjustment','carry_forward_release')),0) as commission_minor,
              coalesce(sum(-amount_minor) filter (where type = 'payout'),0) as paid_minor
         from nova.affiliate_ledger where affiliate_id = $1 and created_at between $2 and $3`,
      [affiliateId, period.start, period.end],
    );
    const balance = await this.payableOf(affiliateId);
    const counts = await this.db.queryOne<Row>(
      `select count(*) filter (where status = 'pending') as pending, count(*) filter (where status = 'approved') as active
         from nova.affiliates where parent_affiliate_id = $1 or id = $1`, [affiliateId],
    );
    const referrals = await this.db.queryOne<Row>(
      `select count(distinct user_id) as total from nova.affiliate_attributions where affiliate_id = $1`, [affiliateId],
    );
    return {
      affiliateId, periodStart: period.start, periodEnd: period.end,
      pendingCount: toNum(counts?.pending), activeCount: toNum(counts?.active, 1),
      totalReferredUsers: toNum(referrals?.total),
      clicks: toNum(funnel?.clicks),
      registrations: toNum(funnel?.registrations),
      firstDeposits: toNum(funnel?.first_deposits),
      withdrawals: toNum(funnel?.withdrawals),
      activeUsers: toNum(funnel?.active_users),
      totalDepositMinor: toBig(panel?.total_deposit_minor),
      totalWithdrawalMinor: toBig(panel?.total_withdrawal_minor),
      playerNetResultMinor: toBig(panel?.player_net_result_minor),
      panelShareMinor: (toBig(panel?.player_net_result_minor) * -70n) / 100n,

      wageredMinor: toBig(stats?.wagered_minor), netRevenueMinor: toBig(stats?.net_revenue_minor),
      commissionMinor: toBig(commission?.commission_minor), payableMinor: balance.payable,
      carryForwardMinor: balance.carry, suppressedMinor: balance.suppressed, paidMinor: toBig(commission?.paid_minor),
      currency: affiliate.currency,
    };
  }

  async payableBalance(affiliateId: UUID) {
    const balance = await this.payableOf(affiliateId);
    return {
      payableMinor: balance.payable, rawMinor: balance.raw, carryForwardMinor: balance.carry,
      suppressedMinor: balance.suppressed, floorApplied: balance.floorApplied,
    };
  }

  async recordClick(input: ReferralClickInput) {
    const code = toStr(input.code).toUpperCase();
    const resolved = await this.db.queryOne<Row>(
      `select a.id, l.id as link_id, l.campaign as link_campaign
         from nova.affiliates a
         left join nova.affiliate_links l
           on l.affiliate_id = a.id
          and upper(l.code) = upper($1)
          and l.is_active = true
        where upper(a.code) = upper($1)
           or lower(a.slug) = lower($1)
           or l.id is not null
        order by case when upper(a.code) = upper($1) then 0 else 1 end,
                 l.created_at desc nulls last
        limit 1`,
      [code],
    );
    if (!resolved) throw new ApiError('INVALID_REFERRAL_CODE');

    const row = await this.db.queryOne<Row>(
      `insert into nova.affiliate_clicks
        (affiliate_id, link_id, code, campaign, ip_hash, user_agent_hash, device_fingerprint, referrer, landing_path, is_likely_bot)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id`,
      [
        toStr(resolved.id),
        toStrOrNull(resolved.link_id),
        code,
        input.campaign ?? toStrOrNull(resolved.link_campaign),
        input.ipHash ?? null,
        input.userAgentHash ?? null,
        input.deviceFingerprint ?? null,
        input.referer ?? null,
        input.landingUrl ?? null,
        input.isBot ?? false,
      ],
    );
    return { clickId: toStr(row!.id), affiliateId: toStr(resolved.id) };
  }

  async attachAttribution(input: AttributionInput) {
    const result = await this.db.rpc<Row>('attach_attribution', {
      p_user_id: input.userId, p_code: input.code, p_click_id: input.clickId ?? null,
      p_ip_hash: input.ipHash ? hashSignal(input.ipHash) : null,
      p_device: input.deviceFingerprint ? hashSignal(input.deviceFingerprint) : null,
    });
    if (!result?.attributed) {
      const reason = toStr(result?.reason, 'UNKNOWN_CODE');
      const code = reason === 'SELF_REFERRAL_BLOCKED' ? 'SELF_REFERRAL_BLOCKED'
        : reason === 'ALREADY_ATTRIBUTED' ? 'ALREADY_ATTRIBUTED'
          : reason === 'AFFILIATE_NOT_APPROVED' ? 'AFFILIATE_NOT_APPROVED' : 'INVALID_REFERRAL_CODE';
      throw new ApiError(code, `Attribution refused: ${reason}`);
    }
    const attribution = await this.getAttribution(input.userId);
    if (!attribution) throw new ApiError('INTERNAL_ERROR', 'Attribution missing after attach');
    return { attribution, created: true };
  }

  async getAttribution(userId: UUID): Promise<AttributionRecord | null> {
    const row = await this.db.queryOne<Row>(
      `select * from nova.affiliate_attributions where user_id = $1 limit 1`, [userId],
    );
    if (!row) return null;
    return {
      id: toStr(row.id), userId: toStr(row.user_id), affiliateId: toStr(row.affiliate_id), code: toStr(row.code),
      campaign: toStrOrNull(row.campaign), clickId: toStrOrNull(row.click_id),
      status: toStr(row.status, 'pending') as AttributionRecord['status'],
      rejectionReason: toStrOrNull(row.rejection_reason),
      signals: Array.isArray(row.signals) ? (row.signals as unknown[]).map((s) => toStr(s)) : [],
      confirmedAt: toIsoOrNull(row.confirmed_at), lockedAt: toIsoOrNull(row.locked_at), createdAt: toIso(row.created_at),
    };
  }

  async replaceAttribution(input: { userId: UUID; affiliateId: UUID; code: string; actorId: UUID; reason: string }): Promise<AttributionRecord> {
    const before = await this.getAttribution(input.userId);
    if (before?.lockedAt) throw new ApiError('FORBIDDEN', 'Attribution is locked and cannot be replaced');
    await this.db.query(`delete from nova.affiliate_attributions where user_id = $1 and status <> 'confirmed'`, [input.userId]);
    const result = await this.db.rpc<Row>('attach_attribution', { p_user_id: input.userId, p_code: input.code });
    if (!result?.attributed) throw new ApiError('CONFLICT', `Attribution refused: ${toStr(result?.reason)}`);
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: 'affiliate.attribution.replace', p_target_type: 'user', p_target_id: input.userId,
      p_before: before as unknown as Row, p_after: { affiliate_id: input.affiliateId, code: input.code },
      p_reason: input.reason, p_correlation_id: null,
    });
    const after = await this.getAttribution(input.userId);
    if (!after) throw new ApiError('INTERNAL_ERROR', 'Attribution missing after replace');
    return after;
  }

  async settlePeriod(input: { affiliateId: UUID; periodStart: string; periodEnd: string; dryRun?: boolean; actorId?: UUID | null }): Promise<AffiliateSettlementResult> {
    const result = await this.db.rpc<Row>('settle_affiliate_period', {
      p_affiliate_id: input.affiliateId, p_period_start: input.periodStart, p_period_end: input.periodEnd,
      p_worker: input.dryRun ? 'admin-dry-run' : 'admin', p_force: input.dryRun ?? false,
    });
    const duplicate = Boolean(result?.duplicate);
    return {
      affiliateId: input.affiliateId, periodStart: input.periodStart, periodEnd: input.periodEnd,
      status: duplicate ? 'duplicate' : 'settled',
      commissionMinor: toBig(result?.gross_minor), payableMinor: toBig(result?.payable_minor),
      carryForwardMinor: toBig(result?.closing_carry_minor), suppressedMinor: toBig(result?.suppressed_minor),
      ledgerEntries: toNum(result?.entries), payoutCreated: Boolean(result?.payout),
      message: duplicate ? 'Period already settled (idempotent)' : undefined,
    };
  }

  async settleAllDue(input: { now: string; dryRun?: boolean }): Promise<AffiliateSettlementResult[]> {
    const affiliates = await this.db.query<Row>(
      `select id, settlement_day_iso, settlement_hour, settlement_minute, settlement_timezone
         from nova.affiliates
        where status = 'approved'`,
    );

    const results: AffiliateSettlementResult[] = [];
    const now = new Date(input.now);

    for (const row of affiliates) {
      const day = Number(row.settlement_day_iso ?? 5);
      const hour = Number(row.settlement_hour ?? 0);
      const minute = Number(row.settlement_minute ?? 0);
      const timezone = toStr(row.settlement_timezone, 'Asia/Tehran');

      const cutoff = lastWeeklyCutoff(now, day, hour, minute, timezone);

      if (cutoff > now) continue;

      const last = await this.db.queryOne<Row>(
        `select max(period_end) as period_end
           from nova.affiliate_settlements
          where affiliate_id = $1`,
        [toStr(row.id)],
      );

      const lastEnd = last?.period_end ? new Date(String(last.period_end)) : null;

      if (lastEnd && lastEnd.getTime() >= cutoff.getTime()) continue;

      const periodStart = new Date(cutoff.getTime() - 7 * 86_400_000);

      results.push(await this.settlePeriod({
        affiliateId: toStr(row.id),
        periodStart: periodStart.toISOString(),
        periodEnd: cutoff.toISOString(),
        dryRun: input.dryRun,
      }));
    }

    return results;
  }
  private validateWalletAddress(asset: AffiliateWalletAsset, address: string): string {
    const value = address.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
      throw new ApiError('BAD_REQUEST', 'Invalid wallet address format');
    }
    if ((asset === 'USDT_TRC20' || asset === 'TRX') && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) {
      throw new ApiError('BAD_REQUEST', 'Invalid TRON wallet address');
    }
    if (asset === 'DOGE' && !/^D[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) {
      throw new ApiError('BAD_REQUEST', 'Invalid Dogecoin wallet address');
    }
    return value;
  }

  private maskWalletAddress(address: string): string {
    const value = address.trim();
    return value.length <= 8 ? '****' : `${value.slice(0, 4)}…${value.slice(-4)}`;
  }





  async listWallets(affiliateId: UUID): Promise<AffiliateWallet[]> {
    const rows = await this.db.query<Row>(
      `select id, affiliate_id, asset, address, address_masked, created_at, updated_at
         from nova.affiliate_wallets
        where affiliate_id = $1
        order by asset asc`,
      [affiliateId],
    );

    return rows.map((row) => ({
      id: toStr(row.id),
      affiliateId: toStr(row.affiliate_id),
      asset: toStr(row.asset) as AffiliateWalletAsset,
      address: toStr(row.address),
      addressMasked: toStr(row.address_masked),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    }));
  }

  async getWallet(
    affiliateId: UUID,
    asset: AffiliateWalletAsset,
  ): Promise<AffiliateWallet | null> {
    const row = await this.db.queryOne<Row>(
      `select id, affiliate_id, asset, address, address_masked, created_at, updated_at
         from nova.affiliate_wallets
        where affiliate_id = $1
          and asset = $2
        limit 1`,
      [affiliateId, asset],
    );

    if (!row) return null;

    return {
      id: toStr(row.id),
      affiliateId: toStr(row.affiliate_id),
      asset: toStr(row.asset) as AffiliateWalletAsset,
      address: toStr(row.address),
      addressMasked: toStr(row.address_masked),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  async upsertWallet(input: {
    affiliateId: UUID;
    asset: AffiliateWalletAsset;
    address: string;
  }): Promise<AffiliateWallet> {
    const address = input.address.trim();

    const addressMasked =
      address.length <= 10
        ? '****'
        : `${address.slice(0, 6)}…${address.slice(-6)}`;

    const row = await this.db.queryOne<Row>(
      `insert into nova.affiliate_wallets
        (affiliate_id, asset, address, address_masked)
       values ($1, $2, $3, $4)
       on conflict (affiliate_id, asset)
       do update set
         address = excluded.address,
         address_masked = excluded.address_masked,
         updated_at = now()
       returning id, affiliate_id, asset, address, address_masked, created_at, updated_at`,
      [input.affiliateId, input.asset, address, addressMasked],
    );

    if (!row) {
      throw new ApiError('INTERNAL_ERROR', 'Wallet was not saved');
    }

    return {
      id: toStr(row.id),
      affiliateId: toStr(row.affiliate_id),
      asset: toStr(row.asset) as AffiliateWalletAsset,
      address: toStr(row.address),
      addressMasked: toStr(row.address_masked),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  async requestPayout(input: {
    affiliateId: UUID;
    amountMinor: string;
    currency: Currency;
    method: string;
    payoutAsset: AffiliateWalletAsset;
    idempotencyKey: string;
  }): Promise<AffiliatePayout> {
    const affiliate = await this.getById(input.affiliateId);
    if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');

    if (BigInt(input.amountMinor) < affiliate.minPayoutMinor) {
      throw new ApiError('PAYOUT_BELOW_MINIMUM_THRESHOLD', `Minimum payout is ${affiliate.minPayoutMinor} minor units`);
    }

    const wallet = await this.getWallet(input.affiliateId, input.payoutAsset);
    if (!wallet) {
      throw new ApiError('BAD_REQUEST', `No ${input.payoutAsset} wallet is configured`);
    }

    const settlement = await this.db.queryOne<Row>(
      `select id from nova.affiliate_settlements
        where affiliate_id = $1 and payout_id is null
        order by period_end desc limit 1`,
      [input.affiliateId],
    );

    const result = await this.db.rpc<Row>('create_affiliate_payout', {
      p_affiliate_id: input.affiliateId,
      p_settlement_id: settlement ? toStr(settlement.id) : null,
      p_amount_minor: input.amountMinor,
      p_currency: input.currency,
      p_idempotency_key: input.idempotencyKey,
      p_source: 'affiliate-portal',
      p_metadata: {
        method: input.method,
        payout_asset: input.payoutAsset,
        destination_masked: wallet.addressMasked,
      },
    });

    const payout = await this.getPayout(toStr(result.id));
    if (!payout) throw new ApiError('INTERNAL_ERROR', 'Payout missing after creation');

    await this.db.query(
      `update nova.affiliate_payouts
          set method = $2,
              payout_asset = $3,
              destination_address = $4,
              destination_masked = $5
        where id = $1
          and (payout_asset is null or destination_address is null)`,
      [payout.id, input.method, input.payoutAsset, wallet.address, wallet.addressMasked],
    );

    return (await this.getPayout(payout.id)) ?? payout;
  }

  async transitionPayout(input: { payoutId: UUID; to: 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled' | 'failed'; actorId: UUID; reason?: string; providerReference?: string; evidenceUrl?: string }): Promise<AffiliatePayout> {
    await this.db.rpc('transition_affiliate_payout', {
      p_payout_id: input.payoutId, p_status: input.to, p_reason: input.reason ?? null,
      p_provider_reference: input.providerReference ?? null,
    });
    if (input.to === 'paid') {
      await this.db.query(`update nova.affiliate_payouts set paid_by = $2, approved_by = coalesce(approved_by, $2) where id = $1`,
        [input.payoutId, input.actorId]);
    }
    if (input.to === 'approved') {
      await this.db.query(`update nova.affiliate_payouts set approved_by = $2 where id = $1`, [input.payoutId, input.actorId]);
    }
    if (input.to === 'rejected') {
      await this.db.query(`update nova.affiliate_payouts set rejected_by = $2, rejected_at = now() where id = $1`,
        [input.payoutId, input.actorId]);
    }
    const payout = await this.getPayout(input.payoutId);
    if (!payout) throw new ApiError('NOT_FOUND', 'Payout not found');
    return payout;
  }

  async listPayouts(filter: { affiliateId?: UUID; status?: string; page?: number; pageSize?: number; from?: string; to?: string }): Promise<Paginated<AffiliatePayout>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
    const params = [filter.affiliateId ?? null, filter.status ?? null, filter.from ?? null, filter.to ?? null, pageSize, (page - 1) * pageSize];
    const rows = await this.db.query<Row>(
      // po.* already carries paid_by/paid_at/rejected_by/rejected_at; the joins only add the
      // actor emails the admin payout queue displays.
      `select po.*, rp.email as rejected_by_email, pp.email as paid_by_email
         from nova.affiliate_payouts po
         left join nova.profiles rp on rp.id = po.rejected_by
         left join nova.profiles pp on pp.id = po.paid_by
        where ($1::uuid is null or po.affiliate_id = $1) and ($2::text is null or po.status::text = $2)
          and ($3::timestamptz is null or po.created_at >= $3) and ($4::timestamptz is null or po.created_at <= $4)
        order by po.created_at desc limit $5 offset $6`, params,
    );
    const count = await this.db.queryOne<Row>(
      `select count(*) as total from nova.affiliate_payouts where ($1::uuid is null or affiliate_id = $1)
        and ($2::text is null or status::text = $2) and ($3::timestamptz is null or created_at >= $3)
        and ($4::timestamptz is null or created_at <= $4)`, params.slice(0, 4),
    );
    const total = toNum(count?.total);
    return { items: rows.map(mapPayout), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async getPayout(payoutId: UUID): Promise<AffiliatePayout | null> {
    const row = await this.db.queryOne<Row>(
      `select po.*, rp.id as rejected_by, app.approved_at as rejected_at, pp.id as paid_by, pp.approved_at as paid_at
         from nova.affiliate_payouts po
         left join nova.profiles rp on rp.id = po.second_approver_id
         left join nova.profiles pp on pp.id = po.approved_by
         left join nova.profiles app on app.id = po.approved_by
        where po.id = $1`, [payoutId],
    );
    return row ? mapPayout(row) : null;
  }

  async adjust(input: { affiliateId: UUID; amountMinor: string; reason: string; actorId: UUID; idempotencyKey: string; kind?: 'adjustment' | 'fraud_hold' | 'fraud_release' }): Promise<{ ledgerEntryId: UUID; payableMinor: bigint }> {
    const result = await this.db.rpc<Row>('affiliate_adjustment', {
      p_affiliate_id: input.affiliateId, p_amount_minor: input.amountMinor, p_currency: 'IRT',
      p_reason: input.reason, p_correlation_id: input.idempotencyKey,
    });
    return { ledgerEntryId: toStr(result.ledger_id), payableMinor: toBig(result.after_minor) };
  }

  async fraudSignals(affiliateId: UUID): Promise<FraudSignalResult> {
    const row = await this.db.queryOne<Row>(
      `select count(*) as open_flags,
              coalesce(max(case severity when 'critical' then 90 when 'high' then 70 when 'medium' then 50 when 'low' then 25 else 10 end), 0) as risk_score
         from nova.affiliate_fraud_flags where affiliate_id = $1 and status = 'open'`, [affiliateId],
    );
    const signals = await this.db.query<Row>(
      `select signal from nova.affiliate_fraud_flags where affiliate_id = $1 and status = 'open' order by created_at desc limit 20`,
      [affiliateId],
    );
    const openCount = toNum(row?.open_flags);
    return {
      affiliateId, riskScore: toNum(row?.risk_score), signals: signals.map((s) => toStr(s.signal)),
      blocked: openCount > 0 && toNum(row?.risk_score) >= 80,
      reviewRequired: openCount > 0,
    };
  }

  async listReferrals(affiliateId: UUID, filter: { page?: number; pageSize?: number }) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
    const rows = await this.db.query<Row>(
      `select at.user_id, at.code, at.status, at.confirmed_at,
              coalesce(sum(b.stake_minor),0) as wagered_minor,
              coalesce(sum(case when b.status in ('settled','partially_settled','cashed_out') then b.payout_minor - b.stake_minor else 0 end),0) as net_revenue_minor,
              coalesce((select sum(l.amount_minor) from nova.affiliate_ledger l where l.affiliate_id = at.affiliate_id and l.user_id = at.user_id),0) as commission_minor,
              coalesce((select sum(p.amount_minor) from nova.payment_transactions p where p.user_id = at.user_id and p.type = 'deposit' and p.status = 'succeeded'),0) as deposit_minor,
              coalesce((select sum(p.amount_minor) from nova.payment_transactions p where p.user_id = at.user_id and p.type = 'withdrawal' and p.status = 'succeeded'),0) as withdrawal_minor
         from nova.affiliate_attributions at
         left join nova.bets b on b.user_id = at.user_id
        where at.affiliate_id = $1
        group by at.user_id, at.code, at.status, at.confirmed_at, at.affiliate_id
        order by at.confirmed_at desc nulls last limit $2 offset $3`,
      [affiliateId, pageSize, (page - 1) * pageSize],
    );
    const count = await this.db.queryOne<Row>(
      `select count(*) as total from nova.affiliate_attributions where affiliate_id = $1`, [affiliateId],
    );
    const total = toNum(count?.total);
    return {
      items: rows.map((r) => ({
        userId: toStr(r.user_id), code: toStr(r.code), status: toStr(r.status),
        confirmedAt: toIsoOrNull(r.confirmed_at), wageredMinor: toBig(r.wagered_minor),
        netRevenueMinor: toBig(r.net_revenue_minor), commissionMinor: toBig(r.commission_minor),
        depositMinor: toBig(r.deposit_minor), withdrawalMinor: toBig(r.withdrawal_minor), panelShareMinor: (toBig(r.net_revenue_minor) * -70n) / 100n,
      })),
      total, page, pageSize, hasMore: page * pageSize < total,
    };
  }

  async listAdminReferralBuckets(affiliateId: UUID, filter: { page?: number; pageSize?: number }) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));

    const rows = await this.db.query<Row>(
      `with referral_currencies as (
         select at.user_id, coalesce(b.currency, a.currency) as currency
           from nova.affiliate_attributions at
           join nova.affiliates a on a.id = at.affiliate_id
           left join nova.bets b on b.user_id = at.user_id
          where at.affiliate_id = $1

         union

         select at.user_id, l.currency
           from nova.affiliate_attributions at
           join nova.affiliate_ledger l
             on l.affiliate_id = at.affiliate_id
            and l.user_id = at.user_id
          where at.affiliate_id = $1

         union

         select at.user_id, p.currency
           from nova.affiliate_attributions at
           join nova.payment_transactions p on p.user_id = at.user_id
          where at.affiliate_id = $1
       )
       select
         at.user_id,
         at.code,
         at.status,
         at.confirmed_at,
         rc.currency,
         coalesce((
           select sum(b.stake_minor)
             from nova.bets b
            where b.user_id = at.user_id
              and b.currency = rc.currency
         ), 0) as wagered_minor,
         coalesce((
           select sum(
             case
               when b.status in ('settled','partially_settled','cashed_out')
               then b.payout_minor - b.stake_minor
               else 0
             end
           )
             from nova.bets b
            where b.user_id = at.user_id
              and b.currency = rc.currency
         ), 0) as net_revenue_minor,
         coalesce((
           select sum(l.amount_minor)
             from nova.affiliate_ledger l
            where l.affiliate_id = at.affiliate_id
              and l.user_id = at.user_id
              and l.currency = rc.currency
         ), 0) as commission_minor,
         coalesce((
           select sum(p.amount_minor)
             from nova.payment_transactions p
            where p.user_id = at.user_id
              and p.type = 'deposit'
              and p.status = 'succeeded'
              and p.currency = rc.currency
         ), 0) as deposit_minor,
         coalesce((
           select sum(p.amount_minor)
             from nova.payment_transactions p
            where p.user_id = at.user_id
              and p.type = 'withdrawal'
              and p.status = 'succeeded'
              and p.currency = rc.currency
         ), 0) as withdrawal_minor
       from nova.affiliate_attributions at
       join referral_currencies rc on rc.user_id = at.user_id
       where at.affiliate_id = $1
       order by at.confirmed_at desc nulls last, at.user_id, rc.currency
       limit $2 offset $3`,
      [affiliateId, pageSize * 10, (page - 1) * pageSize * 10],
    );

    const count = await this.db.queryOne<Row>(
      `select count(*) as total
         from nova.affiliate_attributions
        where affiliate_id = $1`,
      [affiliateId],
    );

    const total = toNum(count?.total);

    return {
      items: rows.map((r) => {
        const netRevenueMinor = toBig(r.net_revenue_minor);
        return {
          userId: toStr(r.user_id),
          code: toStr(r.code),
          status: toStr(r.status),
          confirmedAt: toIsoOrNull(r.confirmed_at),
          currency: toStr(r.currency, 'USD') as Currency,
          wageredMinor: toBig(r.wagered_minor),
          netRevenueMinor,
          commissionMinor: toBig(r.commission_minor),
          depositMinor: toBig(r.deposit_minor),
          withdrawalMinor: toBig(r.withdrawal_minor),
          panelShareMinor: (netRevenueMinor * -70n) / 100n,
        };
      }),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async hierarchy(affiliateId: UUID): Promise<Affiliate[]> {
    const rows = await this.db.query<Row>(
      `with recursive tree as (
         select ${this.AFFILIATE_COLUMNS} from nova.affiliates a left join nova.profiles p on p.id = a.user_id where a.id = $1
         union all
         select ${this.AFFILIATE_COLUMNS} from nova.affiliates a
           left join nova.profiles p on p.id = a.user_id
           join tree t on a.parent_affiliate_id = t.id
       )
       select * from tree`, [affiliateId],
    );
    return rows.map((r) => mapAffiliate(r));
  }

  async publicStats(affiliateId: UUID, period: { start: string; end: string }): Promise<AffiliateStats> {
    return this.getStats(affiliateId, period);
  }
}

function maskDestination(destination: string): string {
  const trimmed = destination.trim();
  if (trimmed.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}
