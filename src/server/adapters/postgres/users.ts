import type { Db } from '@/lib/ports/db';
import type { AdminUserFilter, UserRepository } from '@/lib/ports/repositories';
import type { AccountStatus, AdminUserSummary, AdminPermission, Currency, KycStatus, Paginated, UserLimits, UserProfile, UserRole, UUID } from '@/lib/types';
import { ApiError } from '@/lib/errors';
import { pgArray, type Row, toBig, toIso, toIsoOrNull, toNum, toStr, toStrOrNull } from '@/server/db/rows';
import { permissionsForRole } from '@/server/auth/rbac';
import { hashSignal } from '@/server/utils/hash';
import { sumAdminUsdAmounts } from '@/server/utils/admin-usd';

const PROFILE_SELECT = `
  select p.*,
         coalesce((select jsonb_agg(jsonb_build_object('currency', w.currency, 'balance_minor', w.balance_minor)) from nova.wallets w where w.user_id = p.id), '[]'::jsonb) as balances,
         l.max_stake_per_bet_minor, l.max_stake_per_day_minor, l.max_payout_per_bet_minor, l.max_open_bets,
         l.loss_limit_daily_minor, l.loss_limit_weekly_minor, l.deposit_limit_daily_minor, l.deposit_limit_weekly_minor,
         l.session_limit_minutes, l.self_excluded_until,
         (select id from nova.affiliates a where a.user_id = p.id) as affiliate_id
    from nova.profiles p
    left join nova.user_limits l on l.user_id = p.id and l.currency = p.preferred_currency`;

export function mapLimits(row: Row): UserLimits {
  return {
    maxStakePerBetMinor: row.max_stake_per_bet_minor === null || row.max_stake_per_bet_minor === undefined ? null : toBig(row.max_stake_per_bet_minor),
    maxStakePerDayMinor: row.max_stake_per_day_minor === null || row.max_stake_per_day_minor === undefined ? null : toBig(row.max_stake_per_day_minor),
    maxPayoutPerBetMinor: row.max_payout_per_bet_minor === null || row.max_payout_per_bet_minor === undefined ? null : toBig(row.max_payout_per_bet_minor),
    maxOpenBets: row.max_open_bets === null || row.max_open_bets === undefined ? null : toNum(row.max_open_bets),
    lossLimitDailyMinor: row.loss_limit_daily_minor === null || row.loss_limit_daily_minor === undefined ? null : toBig(row.loss_limit_daily_minor),
    lossLimitWeeklyMinor: row.loss_limit_weekly_minor === null || row.loss_limit_weekly_minor === undefined ? null : toBig(row.loss_limit_weekly_minor),
    depositLimitDailyMinor: row.deposit_limit_daily_minor === null || row.deposit_limit_daily_minor === undefined ? null : toBig(row.deposit_limit_daily_minor),
    depositLimitWeeklyMinor: row.deposit_limit_weekly_minor === null || row.deposit_limit_weekly_minor === undefined ? null : toBig(row.deposit_limit_weekly_minor),
    sessionLimitMinutes: row.session_limit_minutes === null || row.session_limit_minutes === undefined ? null : toNum(row.session_limit_minutes),
  };
}

export function mapProfile(row: Row): UserProfile {
  const role = toStr(row.role, 'user') as UserRole;
  return {
    id: toStr(row.id), publicId: toStr(row.public_id), numericId: toNum(row.numeric_id), email: toStrOrNull(row.email), phone: toStrOrNull(row.phone),
    username: toStrOrNull(row.username), fullName: toStrOrNull(row.display_name),
    preferredLocale: 'en',
    preferredCurrency: toStr(row.preferred_currency, 'IRT') as Currency,
    timezone: toStr(row.timezone, 'Asia/Tehran'),
    status: toStr(row.status, 'active') as AccountStatus, kycStatus: toStr(row.kyc_status, 'not_started') as KycStatus,
    role, permissions: permissionsForRole(role),
    isEmailVerified: Boolean(row.email_verified), isPhoneVerified: Boolean(row.phone_verified ?? false),
    twoFactorEnabled: false, limits: mapLimits(row), affiliateId: toStrOrNull(row.affiliate_id),
    registeredAt: toIso(row.created_at), lastLoginAt: toIsoOrNull(row.last_login_at),
    suspendedReason: toStrOrNull(row.restriction_note),
    selfExcludedUntil: toIsoOrNull(row.self_excluded_until),
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(readonly db: Db) {}

  async getProfile(userId: UUID): Promise<UserProfile | null> {
    const row = await this.db.queryOne<Row>(`${PROFILE_SELECT} where p.id = $1`, [userId]);
    return row ? mapProfile(row) : null;
  }

  async getProfileByEmail(email: string): Promise<UserProfile | null> {
    const row = await this.db.queryOne<Row>(`${PROFILE_SELECT} where lower(p.email) = lower($1)`, [email]);
    return row ? mapProfile(row) : null;
  }

  async updateProfile(userId: UUID, patch: Partial<UserProfile> & { limits?: Partial<UserLimits> }): Promise<UserProfile> {
    await this.db.query(
      `update nova.profiles set
          display_name = coalesce($2, display_name),
          preferred_locale = coalesce($3, preferred_locale),
          preferred_currency = coalesce($4, preferred_currency),
          timezone = coalesce($5, timezone)
        where id = $1`,
      [userId, patch.fullName ?? patch.username ?? null, patch.preferredLocale ?? null,
        patch.preferredCurrency ?? null, patch.timezone ?? null],
    );
    if (patch.limits) await this.updateLimits({ userId, limits: patch.limits, actorId: userId });
    const profile = await this.getProfile(userId);
    if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found');
    return profile;
  }

  async setStatus(input: { userId: UUID; status: string; reason: string; actorId: UUID; until?: string | null }): Promise<UserProfile> {
    const before = await this.getProfile(input.userId);
    if (!before) throw new ApiError('NOT_FOUND', 'Profile not found');
    await this.db.query(
      `update nova.profiles set status = $2, restriction_note = $3 where id = $1`,
      [input.userId, input.status, input.reason],
    );
    await this.db.query(
      `insert into nova.account_events (user_id, event_key, actor_id, metadata)
       values ($1, 'account.status_changed', $2, $3::jsonb)`,
      [input.userId, input.actorId, JSON.stringify({ from: before.status, to: input.status, reason: input.reason })],
    );
    if (input.status === 'self_excluded' && input.until) {
      await this.db.query(
        `insert into nova.user_limits (user_id, currency, self_excluded_until, updated_by) values ($1,$2,$3,$4)
         on conflict (user_id, currency) do update set self_excluded_until = $3, updated_by = $4`,
        [input.userId, before.preferredCurrency, input.until, input.actorId],
      );
    }
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: `account.${input.status}`, p_target_type: 'user', p_target_id: input.userId,
      p_before: { status: before.status }, p_after: { status: input.status }, p_reason: input.reason,
    });
    const after = await this.getProfile(input.userId);
    if (!after) throw new ApiError('NOT_FOUND', 'Profile not found');
    return after;
  }

  async listForAdmin(filter: AdminUserFilter): Promise<Paginated<AdminUserSummary>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
    const sortColumn = filter.sortBy === 'last_login_at' ? 'p.last_login_at' : 'p.created_at';
    const direction = filter.sortDirection === 'asc' ? 'asc' : 'desc';
    const params = [
      filter.search ?? null, filter.status ?? null, filter.role ?? null, filter.kycStatus ?? null,
      filter.affiliateId ?? null, filter.from ?? null, filter.to ?? null, pageSize, (page - 1) * pageSize,
    ];
    const where = `
      where ($1::text is null or p.email ilike '%' || $1 || '%' or p.phone ilike '%' || $1 || '%'
              or p.public_id ilike '%' || $1 || '%' or p.display_name ilike '%' || $1 || '%' or p.numeric_id::text = trim($1))
        and ($2::text is null or p.status::text = $2) and ($3::text is null or p.role::text = any(string_to_array($3::text,',')))
        and ($4::text is null or p.kyc_status::text = $4)
        and ($5::uuid is null or exists (select 1 from nova.affiliates a where a.user_id = p.id and (a.id = $5 or a.parent_affiliate_id = $5)))
        and ($6::timestamptz is null or p.created_at >= $6) and ($7::timestamptz is null or p.created_at <= $7)`;
    const rows = await this.db.query<Row>(
      `select p.id, p.public_id, p.numeric_id, p.email, p.phone, p.display_name, p.status::text as status, p.role::text as role,
              p.kyc_status::text as kyc_status, p.created_at, p.last_login_at,
              coalesce((select jsonb_agg(jsonb_build_object('currency', w.currency, 'balance_minor', w.balance_minor)) from nova.wallets w where w.user_id = p.id), '[]'::jsonb) as balances,
              coalesce((select jsonb_agg(jsonb_build_object('currency', x.currency, 'amount_minor', x.amount_minor))
                        from (select b.currency, sum(b.stake_minor) as amount_minor
                              from nova.bets b where b.user_id = p.id group by b.currency) x), '[]'::jsonb) as stake_by_currency,
              coalesce((select jsonb_agg(jsonb_build_object('currency', x.currency, 'amount_minor', x.amount_minor))
                        from (select b.currency, sum(b.payout_minor) as amount_minor
                              from nova.bets b where b.user_id = p.id and b.payout_minor is not null group by b.currency) x), '[]'::jsonb) as payout_by_currency,
              coalesce((select jsonb_agg(jsonb_build_object('currency', x.currency, 'amount_minor', x.amount_minor))
                        from (select b.currency, sum(coalesce(b.payout_minor,0) - b.stake_minor) as amount_minor
                              from nova.bets b
                              where b.user_id = p.id
                                and b.status in ('settled','void','partially_settled','cashed_out')
                              group by b.currency) x), '[]'::jsonb) as net_result_by_currency,
              (select count(*) from nova.bets b where b.user_id = p.id and b.status in ('accepted','partially_settled')) as open_bets,
              (select id from nova.affiliates a where a.user_id = p.id) as affiliate_id,
              (select max(case f.severity when 'critical' then 90 when 'high' then 70 when 'medium' then 50 when 'low' then 25 else 10 end)
                 from nova.affiliate_fraud_flags f join nova.affiliates a on a.id = f.affiliate_id where a.user_id = p.id) as risk_score
         from nova.profiles p ${where}
        order by ${sortColumn} ${direction} nulls last limit $8 offset $9`, params,
    );
    const count = await this.db.queryOne<Row>(`select count(*) as total from nova.profiles p ${where}`, params.slice(0, 7));
    const total = toNum(count?.total);
    const mapped = rows.map((r) => {
      const balanceSummary = Array.isArray(r.balances)
        ? (r.balances as Row[]).map((b) => ({
            currency: toStr(b.currency, 'IRT') as Currency,
            balanceMinor: toBig(b.balance_minor),
          }))
        : [];
      return {
        id: toStr(r.id), publicId: toStr(r.public_id), numericId: toNum(r.numeric_id), email: toStrOrNull(r.email), phone: toStrOrNull(r.phone),
        username: toStrOrNull(r.username), status: toStr(r.status, 'active'), role: toStr(r.role, 'user') as UserRole,
        kycStatus: toStr(r.kyc_status, 'not_started'),
        balanceSummary,
        usdBalanceMinor: 0n as bigint | null,
        totalStakeMinor: 0n as bigint | null, totalPayoutMinor: 0n as bigint | null,
        netResultMinor: 0n as bigint | null, openBets: toNum(r.open_bets),
        affiliateId: toStrOrNull(r.affiliate_id),
        riskScore: r.risk_score === null || r.risk_score === undefined ? null : toNum(r.risk_score),
        registeredAt: toIso(r.created_at), lastLoginAt: toIsoOrNull(r.last_login_at),
      };
    });

    const monetaryRows = mapped.map((item, index) => {
      const row = rows[index];
      if (!row) throw new Error('ADMIN_USER_ROW_MAPPING_FAILED');

      const currencies = [
        ...item.balanceSummary.map((b) => b.currency),
        ...(Array.isArray(row.stake_by_currency)
          ? (row.stake_by_currency as Row[]).map((x) => toStr(x.currency))
          : []),
        ...(Array.isArray(row.payout_by_currency)
          ? (row.payout_by_currency as Row[]).map((x) => toStr(x.currency))
          : []),
        ...(Array.isArray(row.net_result_by_currency)
          ? (row.net_result_by_currency as Row[]).map((x) => toStr(x.currency))
          : []),
      ];

      return { item, row, currencies };
    });

    // Only actual USD may be summed into USD reports. Mixed currencies are
    // explicitly unavailable rather than invoking external FX or fabricating USD.
    for (const { item, row } of monetaryRows) {
      const projected = (name: string) => Array.isArray(row[name])
        ? (row[name] as Row[]).map((value) => ({
            currency: toStr(value.currency), amountMinor: toBig(value.amount_minor),
          }))
        : [];

      item.usdBalanceMinor = sumAdminUsdAmounts(
        item.balanceSummary.map((balance) => ({ currency: balance.currency, amountMinor: balance.balanceMinor })),
      );
      item.totalStakeMinor = sumAdminUsdAmounts(projected('stake_by_currency'));
      item.totalPayoutMinor = sumAdminUsdAmounts(projected('payout_by_currency'));
      item.netResultMinor = sumAdminUsdAmounts(projected('net_result_by_currency'));
    }

    return {
      items: mapped,
      total, page, pageSize, hasMore: page * pageSize < total,
    };
  }

  async getAdminSummary(userId: UUID): Promise<AdminUserSummary | null> {
    const result = await this.listForAdmin({ search: null as unknown as string, page: 1, pageSize: 1, affiliateId: undefined });
    const found = result.items.find((i) => i.id === userId);
    if (found) return found;
    const row = await this.db.queryOne<Row>(
      `select p.id, p.public_id, p.numeric_id, p.email, p.phone, p.display_name, p.status::text as status, p.role::text as role,
              p.kyc_status::text as kyc_status, p.created_at, p.last_login_at,
              coalesce((select jsonb_agg(jsonb_build_object('currency', x.currency, 'amount_minor', x.amount_minor)) from (select b.currency, sum(b.stake_minor) as amount_minor from nova.bets b where b.user_id = p.id group by b.currency) x), '[]'::jsonb) as stake_by_currency,
              coalesce((select jsonb_agg(jsonb_build_object('currency', x.currency, 'amount_minor', x.amount_minor)) from (select b.currency, sum(b.payout_minor) as amount_minor from nova.bets b where b.user_id = p.id and b.payout_minor is not null group by b.currency) x), '[]'::jsonb) as payout_by_currency,
              (select count(*) from nova.bets b where b.user_id = p.id and b.status in ('accepted','partially_settled')) as open_bets
         from nova.profiles p where p.id = $1`, [userId],
    );
    if (!row) return null;
    const balances = await this.db.query<Row>(`select currency, balance_minor from nova.wallets where user_id = $1`, [userId]);
    const balanceSummary = balances.map((b) => ({
      currency: toStr(b.currency) as Currency,
      balanceMinor: toBig(b.balance_minor),
    }));
    const stakeRows = Array.isArray(row.stake_by_currency) ? row.stake_by_currency as Row[] : [];
    const payoutRows = Array.isArray(row.payout_by_currency) ? row.payout_by_currency as Row[] : [];
    const usdBalanceMinor = sumAdminUsdAmounts(balanceSummary.map(
      (balance) => ({ currency: balance.currency, amountMinor: balance.balanceMinor }),
    ));
    const totalStakeMinor = sumAdminUsdAmounts(stakeRows.map(
      (value) => ({ currency: toStr(value.currency), amountMinor: toBig(value.amount_minor) }),
    ));
    const totalPayoutMinor = sumAdminUsdAmounts(payoutRows.map(
      (value) => ({ currency: toStr(value.currency), amountMinor: toBig(value.amount_minor) }),
    ));
    return {
      id: toStr(row.id), publicId: toStr(row.public_id), numericId: toNum(row.numeric_id), email: toStrOrNull(row.email), phone: toStrOrNull(row.phone),
      username: toStrOrNull(row.username), status: toStr(row.status), role: toStr(row.role) as UserRole,
      kycStatus: toStr(row.kyc_status),
      balanceSummary,
      usdBalanceMinor,
      totalStakeMinor, totalPayoutMinor, netResultMinor: totalPayoutMinor === null || totalStakeMinor === null ? null : totalPayoutMinor - totalStakeMinor, openBets: toNum(row.open_bets),
      affiliateId: null, riskScore: null, registeredAt: toIso(row.created_at), lastLoginAt: toIsoOrNull(row.last_login_at),
    };
  }

  async setKyc(input: { userId: UUID; status: string; actorId: UUID; note?: string }): Promise<UserProfile> {
    const before = await this.getProfile(input.userId);
    await this.db.query(`update nova.profiles set kyc_status = $2 where id = $1`, [input.userId, input.status]);
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: 'account.kyc', p_target_type: 'user', p_target_id: input.userId,
      p_before: { kyc_status: before?.kycStatus }, p_after: { kyc_status: input.status }, p_reason: input.note ?? null,
    });
    const after = await this.getProfile(input.userId);
    if (!after) throw new ApiError('NOT_FOUND', 'Profile not found');
    return after;
  }

  async addNote(input: { userId: UUID; actorId: UUID; note: string; isInternal: boolean }) {
    const row = await this.db.queryOne<Row>(
      `insert into nova.user_notes (user_id, actor_id, note, is_internal) values ($1,$2,$3,$4) returning id`,
      [input.userId, input.actorId, input.note, input.isInternal],
    );
    return { id: toStr(row!.id) };
  }

  async listNotes(userId: UUID) {
    const rows = await this.db.query<Row>(
      `select id, note, actor_id, is_internal, created_at from nova.user_notes where user_id = $1 order by created_at desc limit 100`,
      [userId],
    );
    return rows.map((r) => ({
      id: toStr(r.id), note: toStr(r.note), actorId: toStrOrNull(r.actor_id),
      createdAt: toIso(r.created_at), isInternal: Boolean(r.is_internal),
    }));
  }

  async setRole(input: { userId: UUID; role: string; actorId: UUID; reason: string }): Promise<UserProfile> {
    const before = await this.getProfile(input.userId);
    await this.db.query(`update nova.profiles set role = $2 where id = $1`, [input.userId, input.role]);
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: 'admin.role.assign', p_target_type: 'user', p_target_id: input.userId,
      p_before: { role: before?.role }, p_after: { role: input.role }, p_reason: input.reason,
    });
    const after = await this.getProfile(input.userId);
    if (!after) throw new ApiError('NOT_FOUND', 'Profile not found');
    return after;
  }

  async getLimits(userId: UUID): Promise<UserLimits> {
    const row = await this.db.queryOne<Row>(
      `select * from nova.user_limits where user_id = $1 order by updated_at desc limit 1`, [userId],
    );
    return row ? mapLimits(row) : mapLimits({});
  }

  async updateLimits(input: { userId: UUID; limits: Partial<UserLimits>; actorId: UUID }): Promise<UserLimits> {
    const profile = await this.getProfile(input.userId);
    const currency = profile?.preferredCurrency ?? 'IRT';
    const l = input.limits;
    await this.db.query(
      `insert into nova.user_limits (user_id, currency, max_stake_per_bet_minor, max_stake_per_day_minor, max_payout_per_bet_minor,
          max_open_bets, loss_limit_daily_minor, loss_limit_weekly_minor, deposit_limit_daily_minor, deposit_limit_weekly_minor,
          session_limit_minutes, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (user_id, currency) do update set
          max_stake_per_bet_minor = coalesce(excluded.max_stake_per_bet_minor, nova.user_limits.max_stake_per_bet_minor),
          max_stake_per_day_minor = coalesce(excluded.max_stake_per_day_minor, nova.user_limits.max_stake_per_day_minor),
          max_payout_per_bet_minor = coalesce(excluded.max_payout_per_bet_minor, nova.user_limits.max_payout_per_bet_minor),
          max_open_bets = coalesce(excluded.max_open_bets, nova.user_limits.max_open_bets),
          loss_limit_daily_minor = coalesce(excluded.loss_limit_daily_minor, nova.user_limits.loss_limit_daily_minor),
          loss_limit_weekly_minor = coalesce(excluded.loss_limit_weekly_minor, nova.user_limits.loss_limit_weekly_minor),
          deposit_limit_daily_minor = coalesce(excluded.deposit_limit_daily_minor, nova.user_limits.deposit_limit_daily_minor),
          deposit_limit_weekly_minor = coalesce(excluded.deposit_limit_weekly_minor, nova.user_limits.deposit_limit_weekly_minor),
          session_limit_minutes = coalesce(excluded.session_limit_minutes, nova.user_limits.session_limit_minutes),
          updated_by = excluded.updated_by, updated_at = now()`,
      [input.userId, currency,
        l.maxStakePerBetMinor?.toString() ?? null, l.maxStakePerDayMinor?.toString() ?? null,
        l.maxPayoutPerBetMinor?.toString() ?? null, l.maxOpenBets ?? null,
        l.lossLimitDailyMinor?.toString() ?? null, l.lossLimitWeeklyMinor?.toString() ?? null,
        l.depositLimitDailyMinor?.toString() ?? null, l.depositLimitWeeklyMinor?.toString() ?? null,
        l.sessionLimitMinutes ?? null, input.actorId],
    );
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: 'account.limits.update', p_target_type: 'user', p_target_id: input.userId,
      p_before: null, p_after: l as unknown as Row, p_reason: 'limits updated',
    });
    return this.getLimits(input.userId);
  }

  async sessionLimits(userId: UUID) {
    const limits = await this.getLimits(userId);
    return { lossLimitDailyMinor: limits.lossLimitDailyMinor, lossLimitWeeklyMinor: limits.lossLimitWeeklyMinor };
  }
}

export function permissionsOf(profile: UserProfile): AdminPermission[] {
  return permissionsForRole(profile.role);
}

export const hashLoginSignal = hashSignal;
