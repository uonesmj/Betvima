import type { Db } from '@/lib/ports/db';
import type { AdminAdjustmentInput, PostWalletEntryInput, PostWalletEntryResult, WalletRepository } from '@/lib/ports/repositories';
import type { AdminAdjustmentRequest, Currency, Paginated, UUID, Wallet, WalletEntry, WalletStatement } from '@/lib/types';
import { ApiError } from '@/lib/errors';
import { type Row, toBig, toBigOrNull, toIso, toIsoOrNull, toJson, toNum, toStr, toStrOrNull } from '@/server/db/rows';

export function mapWallet(row: Row): Wallet {
  const balance = toBig(row.balance_minor);
  const locked = toBig(row.locked_minor);
  return {
    id: toStr(row.id), userId: toStr(row.user_id), currency: toStr(row.currency, 'IRT') as Currency,
    status: row.is_frozen ? 'frozen' : 'active',
    balanceMinor: balance, availableMinor: balance - locked, heldMinor: locked, bonusMinor: 0n,
    lifetimeDepositMinor: toBig(row.lifetime_deposit_minor), lifetimeWithdrawalMinor: toBig(row.lifetime_withdrawal_minor),
    lifetimeStakeMinor: toBig(row.lifetime_stake_minor), lifetimePayoutMinor: toBig(row.lifetime_payout_minor),
    version: toNum(row.version, 1), createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at),
  };
}

export function mapEntry(row: Row): WalletEntry {
  const amount = toBig(row.amount_minor);
  return {
    id: toStr(row.id), walletId: toStr(row.wallet_id), userId: toStr(row.user_id),
    currency: toStr(row.currency, 'IRT') as Currency, type: toStr(row.type) as WalletEntry['type'],
    direction: amount >= 0n ? 'credit' : 'debit', amountMinor: amount,
    balanceAfterMinor: toBig(row.balance_after_minor), status: toStr(row.status, 'posted') as WalletEntry['status'],
    referenceType: toStrOrNull(row.reference), referenceId: toStrOrNull(row.reference),
    betId: toStrOrNull(row.bet_id), paymentId: toStrOrNull(row.payment_transaction_id),
    description: toStrOrNull(row.reason), metadata: toJson<Record<string, unknown> | null>(row.metadata, null),
    idempotencyKey: toStr(row.idempotency_key), reversesEntryId: toStrOrNull(row.reversal_of), reversedByEntryId: null,
    createdAt: toIso(row.created_at), createdBy: toStrOrNull(row.actor_id),
  };
}

export class PostgresWalletRepository implements WalletRepository {
  constructor(readonly db: Db) {}

  async postEntry(input: PostWalletEntryInput): Promise<PostWalletEntryResult> {
    const signed = input.direction === 'debit' ? `-${input.amountMinor}` : input.amountMinor;
    const result = await this.db.rpc<Row>('post_wallet_entry', {
      p_user_id: input.userId,
      p_type: input.type,
      p_amount_minor: signed,
      p_currency: input.currency,
      p_idempotency_key: input.idempotencyKey,
      p_reference: input.referenceType ?? null,
      p_bet_id: input.betId ?? null,
      p_payment_transaction_id: input.paymentId ?? null,
      p_reason: input.description ?? null,
      p_actor_id: input.createdBy ?? input.actor?.adminId ?? null,
      p_metadata: input.metadata ?? {},
      p_balance_floor: input.direction === 'debit' ? 0 : null,
    });
    return {
      entryId: toStr(result.transaction_id), walletId: toStrOrNull(result.wallet_id) ?? '',
      balanceAfterMinor: toBig(result.balance_after_minor), idempotentReplay: Boolean(result.idempotent_replay),
    };
  }

  async getWallet(_c: unknown, userId: UUID, currency: Currency): Promise<Wallet | null> {
    const row = await this.db.queryOne<Row>(
      `select w.*,
              coalesce((select sum(amount_minor) from nova.wallet_transactions t where t.wallet_id = w.id and t.type = 'deposit'),0) as lifetime_deposit_minor,
              coalesce((select sum(-amount_minor) from nova.wallet_transactions t where t.wallet_id = w.id and t.type in ('withdrawal','withdrawal_hold')),0) as lifetime_withdrawal_minor,
              coalesce((select sum(-amount_minor) from nova.wallet_transactions t where t.wallet_id = w.id and t.type = 'bet_debit'),0) as lifetime_stake_minor,
              coalesce((select sum(amount_minor) from nova.wallet_transactions t where t.wallet_id = w.id and t.type in ('win_credit','void_refund','cashout')),0) as lifetime_payout_minor
         from nova.wallets w where w.user_id = $1 and w.currency = $2`, [userId, currency],
    );
    return row ? mapWallet(row) : null;
  }

  async ensureWallet(userId: UUID, currency: Currency): Promise<Wallet> {
    await this.db.query(
      `insert into nova.wallets (user_id, currency, balance_minor) values ($1, $2, 0) on conflict (user_id, currency) do nothing`,
      [userId, currency],
    );
    const wallet = await this.getWallet(null, userId, currency);
    if (!wallet) throw new ApiError('WALLET_NOT_FOUND');
    return wallet;
  }

  async listEntries(_c: unknown, userId: UUID, filter: { currency?: Currency; type?: string; from?: string; to?: string; page?: number; pageSize?: number }): Promise<WalletStatement> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
    const currency = filter.currency ?? 'IRR';
    const params = [userId, currency, filter.type ?? null, filter.from ?? null, filter.to ?? null, pageSize, (page - 1) * pageSize];
    const rows = await this.db.query<Row>(
      `select * from nova.wallet_transactions
        where user_id = $1 and currency = $2
          and ($3::text is null or type::text = $3)
          and ($4::timestamptz is null or created_at >= $4)
          and ($5::timestamptz is null or created_at <= $5)
        order by created_at desc limit $6 offset $7`, params,
    );
    const totals = await this.db.queryOne<Row>(
      `select coalesce(sum(case when amount_minor > 0 then amount_minor else 0 end),0) as credit_minor,
              coalesce(sum(case when amount_minor < 0 then -amount_minor else 0 end),0) as debit_minor,
              coalesce(sum(amount_minor),0) as net_minor
         from nova.wallet_transactions where user_id = $1 and currency = $2`, [userId, currency],
    );
    const wallet = await this.ensureWallet(userId, currency);
    const count = await this.db.queryOne<Row>(
      `select count(*) as total from nova.wallet_transactions where user_id = $1 and currency = $2
         and ($3::text is null or type::text = $3) and ($4::timestamptz is null or created_at >= $4) and ($5::timestamptz is null or created_at <= $5)`,
      params.slice(0, 5),
    );
    return {
      wallet, entries: rows.map(mapEntry),
      totals: { creditMinor: toBig(totals?.credit_minor), debitMinor: toBig(totals?.debit_minor), netMinor: toBig(totals?.net_minor) },
      page, pageSize, hasMore: page * pageSize < toNum(count?.total),
    };
  }

  /** Immediate, audited adjustment - reserved for automated/system corrections. */
  async adminAdjust(input: AdminAdjustmentInput): Promise<AdminAdjustmentRequest> {
    const signed = input.direction === 'debit' ? `-${input.amountMinor}` : input.amountMinor;
    const result = await this.db.rpc<Row>('post_wallet_entry', {
      p_user_id: input.userId, p_type: 'adjustment', p_amount_minor: signed, p_currency: input.currency,
      p_idempotency_key: input.idempotencyKey, p_reference: input.type, p_reason: input.reason,
      p_actor_id: input.actorId, p_metadata: { adjustment_type: input.type, notes: input.notes ?? null },
      p_balance_floor: input.direction === 'debit' ? 0 : null,
    });
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: 'wallet.adjustment', p_target_type: 'user', p_target_id: input.userId,
      p_before: null, p_after: { amount_minor: input.amountMinor, direction: input.direction, currency: input.currency },
      p_reason: input.reason, p_correlation_id: input.idempotencyKey,
    });
    return {
      id: toStr(result.transaction_id), userId: input.userId, currency: input.currency,
      amountMinor: BigInt(input.amountMinor), direction: input.direction, type: input.type, reason: input.reason,
      status: 'applied', requestedBy: input.actorId, requestedAt: new Date().toISOString(),
      approvedBy: null, approvedAt: null, decisionReason: null, walletEntryId: toStr(result.transaction_id),
    };
  }

  async requestAdminAdjustment(input: AdminAdjustmentInput): Promise<AdminAdjustmentRequest> {
    const row = await this.db.queryOne<Row>(
      `insert into nova.admin_adjustments (user_id, currency, amount_minor, direction, adjustment_type, reason, notes,
          status, requires_dual_approval, requested_by, correlation_id)
       values ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10) returning *`,
      [input.userId, input.currency, input.amountMinor, input.direction, input.type, input.reason, input.notes ?? null,
        true, input.actorId, input.idempotencyKey],
    );
    return mapAdjustment(row!);
  }

  async approveAdminAdjustment(input: { requestId: UUID; actorId: UUID; approve: boolean; reason?: string }): Promise<AdminAdjustmentRequest> {
    const request = await this.db.queryOne<Row>(`select * from nova.admin_adjustments where id = $1 for update`, [input.requestId]);
    if (!request) throw new ApiError('NOT_FOUND', 'Adjustment request not found');
    if (toStr(request.status) !== 'pending') throw new ApiError('CONFLICT', 'Adjustment request is already final');
    if (toStr(request.requested_by) === input.actorId) throw new ApiError('SELF_APPROVAL_BLOCKED');
    if (!input.approve) {
      const row = await this.db.queryOne<Row>(
        `update nova.admin_adjustments set status = 'rejected', approved_by = $2, approved_at = now(), decision_reason = $3
          where id = $1 returning *`, [input.requestId, input.actorId, input.reason ?? 'rejected'],
      );
      return mapAdjustment(row!);
    }
    // The money is only moved on approval, through the single authoritative wallet path.
    const signed = toStr(request.direction) === 'debit'
      ? `-${toBig(request.amount_minor)}` : `${toBig(request.amount_minor)}`;
    const entry = await this.db.rpc<Row>('post_wallet_entry', {
      p_user_id: toStr(request.user_id), p_type: 'adjustment', p_amount_minor: signed,
      p_currency: toStr(request.currency), p_idempotency_key: `adjustment:${input.requestId}`,
      p_reference: toStr(request.adjustment_type), p_reason: toStr(request.reason),
      p_actor_id: input.actorId, p_metadata: { adjustment_id: input.requestId },
      p_balance_floor: toStr(request.direction) === 'debit' ? 0 : null,
    });
    const row = await this.db.queryOne<Row>(
      `update nova.admin_adjustments set status = 'applied', approved_by = $2, approved_at = now(),
              decision_reason = $3, wallet_transaction_id = $4
        where id = $1 returning *`,
      [input.requestId, input.actorId, input.reason ?? 'approved', toStr(entry.transaction_id)],
    );
    return mapAdjustment(row!);
  }

  async listAdminAdjustments(filter: { status?: string; page?: number; pageSize?: number }): Promise<Paginated<AdminAdjustmentRequest>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
    const rows = await this.db.query<Row>(
      `select a.*, p.email as user_email from nova.admin_adjustments a left join nova.profiles p on p.id = a.user_id
        where ($1::text is null or a.status = $1) order by a.requested_at desc limit $2 offset $3`,
      [filter.status ?? null, pageSize, (page - 1) * pageSize],
    );
    const count = await this.db.queryOne<Row>(
      `select count(*) as total from nova.admin_adjustments where ($1::text is null or status = $1)`, [filter.status ?? null],
    );
    const total = toNum(count?.total);
    return { items: rows.map((r) => mapAdjustment(r, toStrOrNull(r.user_email))), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async checkDepositLimits(userId: UUID, currency: Currency, amountMinor: bigint) {
    const limits = await this.db.queryOne<Row>(
      `select deposit_limit_daily_minor, deposit_limit_weekly_minor from nova.user_limits where user_id = $1 and currency = $2`,
      [userId, currency],
    );
    const spent = await this.db.queryOne<Row>(
      `select coalesce(sum(amount_minor),0) as today from nova.payment_transactions
        where user_id = $1 and currency = $2 and type = 'deposit' and status = 'succeeded'
          and completed_at >= date_trunc('day', now())`, [userId, currency],
    );
    const weekSpent = await this.db.queryOne<Row>(
      `select coalesce(sum(amount_minor),0) as week from nova.payment_transactions
        where user_id = $1 and currency = $2 and type = 'deposit' and status = 'succeeded'
          and completed_at >= date_trunc('week', now())`, [userId, currency],
    );
    const dailyLimit = toBigOrNull(limits?.deposit_limit_daily_minor);
    const weeklyLimit = toBigOrNull(limits?.deposit_limit_weekly_minor);
    const dailyRemaining = dailyLimit === null ? 10n ** 18n : dailyLimit - toBig(spent?.today);
    const weeklyRemaining = weeklyLimit === null ? 10n ** 18n : weeklyLimit - toBig(weekSpent?.week);
    const allowed = amountMinor <= dailyRemaining && amountMinor <= weeklyRemaining;
    return {
      allowed, reasonCode: allowed ? undefined : 'DEPOSIT_LIMIT_EXCEEDED',
      dailyRemainingMinor: dailyRemaining < 0n ? 0n : dailyRemaining,
      weeklyRemainingMinor: weeklyRemaining < 0n ? 0n : weeklyRemaining,
    };
  }
}

function mapAdjustment(row: Row, userEmail?: string | null): AdminAdjustmentRequest {
  return {
    id: toStr(row.id), userId: toStr(row.user_id), currency: toStr(row.currency, 'IRT') as Currency,
    amountMinor: toBig(row.amount_minor), direction: toStr(row.direction, 'credit') as 'credit' | 'debit',
    type: toStr(row.adjustment_type), reason: toStr(row.reason),
    status: toStr(row.status, 'pending') as AdminAdjustmentRequest['status'],
    requestedBy: toStr(row.requested_by), requestedAt: toIso(row.requested_at),
    approvedBy: toStrOrNull(row.approved_by), approvedAt: toIsoOrNull(row.approved_at),
    decisionReason: toStrOrNull(row.decision_reason), walletEntryId: toStrOrNull(row.wallet_transaction_id),
    ...(userEmail ? { userEmail } : {}),
  } as AdminAdjustmentRequest;
}
