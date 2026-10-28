import { z } from 'zod';
import { ApiError, jsonOk, withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { toStr } from '@/server/db/rows';
import { casinoFinance } from '@/server/admin/casino-finance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SqlRow = Record<string, unknown>;
const uuid = z.string().uuid();
const plain = (value: unknown): string => value == null ? '0' : String(value);
const iso = (value: unknown): string | null => value == null ? null
  : value instanceof Date ? value.toISOString() : String(value);

/**
 * Native administrator's user dossier. All amounts are in the ORIGINAL
 * currency's minor units: no implicit FX, no external FX vendor calls.
 * This endpoint is read-only. No wallet/bonus/bet mutation is performed.
 * Existing casino KYC approval remains on the existing website unchanged.
 */
export const GET = withErrorHandling('admin.mobile.user_overview', async (
  ctx, request: Request, params: { params: Promise<{ id: string }> },
) => {
  const { services } = await withAdmin(request, ctx, 'users.view');
  const { id } = await params.params;
  if (!uuid.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid user ID');

  const profile = await services.db.queryOne<SqlRow>(
    `select id, public_id, numeric_id, username, email, phone, status::text as status,
            role::text as role, kyc_status::text as kyc_status,
            created_at, last_login_at, preferred_currency
       from nova.profiles where id = $1 and role::text in ('user','affiliate')`, [id],
  );
  if (!profile) throw new ApiError('NOT_FOUND', 'Customer not found');

  const [wallets, payments, bets, bonuses, lastActivity, registrationEvent, casino] = await Promise.all([
    services.db.query<SqlRow>(
      `select currency, balance_minor, locked_minor, is_frozen
         from nova.wallets where user_id = $1 order by currency`, [id]),
    services.db.query<SqlRow>(
      `select type::text as direction, currency,
              count(*)::bigint as total_count,
              coalesce(sum(amount_minor),0)::bigint as total_minor
         from nova.payment_transactions
        where user_id = $1 and (
          (type::text = 'deposit' and status::text = 'succeeded')
          or (type::text = 'withdrawal' and status::text in ('succeeded','paid'))
        )
        group by type::text, currency order by currency, direction`, [id]),
    services.db.query<SqlRow>(
      `select currency,
              count(*) filter (where status::text in ('accepted','partially_settled'))::bigint as open_count,
              count(*) filter (where status::text not in ('accepted','partially_settled','manual_review'))::bigint as closed_count,
              coalesce(sum(stake_minor) filter (where status::text in ('accepted','partially_settled')),0)::bigint as open_stake_minor,
              coalesce(sum(stake_minor) filter (where status::text not in ('accepted','partially_settled','manual_review')),0)::bigint as closed_stake_minor,
              coalesce(sum(payout_minor) filter (where status::text in ('settled','cashed_out','partially_settled')),0)::bigint as payout_minor,
              coalesce(sum(stake_minor) filter (where status::text in ('settled','cashed_out')),0)::bigint as settled_stake_minor,
              coalesce(sum(payout_minor) filter (where status::text in ('settled','cashed_out')),0)::bigint as settled_payout_minor
         from nova.bets where user_id = $1 group by currency order by currency`, [id]),
    services.db.query<SqlRow>(
      `select bg.id, bg.currency, bg.amount_minor, bg.remaining_amount_minor, bg.status,
              bg.granted_at, bg.expires_at,
              coalesce(p.title_fa,p.title,p.slug,'Bonus') as title
         from nova.bonus_grants bg left join nova.promotions p on p.id=bg.promotion_id
        where bg.user_id=$1 order by bg.granted_at desc limit 100`, [id]),
    services.db.queryOne<SqlRow>(
      `select max(last_seen_at) as last_seen_at,
              coalesce(bool_or(revoked_at is null and expires_at > now()
                        and last_seen_at > now() - interval '5 minutes'),false) as recently_active
         from nova.user_sessions where user_id=$1`, [id]),
    services.db.queryOne<SqlRow>(
      `select metadata->>'registration_source' as source
         from nova.account_events
        where user_id=$1 and event_key in ('auth.registered','account.registered','user.registered')
        order by created_at asc limit 1`, [id]),
    casinoFinance(services.db, id, null),
  ]);

  const source = toStr(registrationEvent?.source, '').toLowerCase();
  // Historical registrations did not persist a trustworthy source. Do not infer
  // signup origin from recent bets, login sessions or the current device.
  const registrationSource = ['android','app'].includes(source) ? 'app'
    : ['web','website','site'].includes(source) ? 'web' : 'unknown';
  const now = Date.now();

  return jsonOk({
    user: {
      id: profile.id, publicId: profile.public_id, numericId: profile.numeric_id == null ? null : plain(profile.numeric_id),
      username: profile.username, email: profile.email, phone: profile.phone,
      registeredAt: iso(profile.created_at), registrationSource,
      status: profile.status, role: profile.role, kycStatus: profile.kyc_status,
      preferredCurrency: profile.preferred_currency,
      lastLoginAt: iso(profile.last_login_at),
      lastSeenAt: iso(lastActivity?.last_seen_at),
      recentlyActive: lastActivity?.recently_active === true,
    },
    balances: wallets.map((row) => ({
      currency: row.currency, balanceMinor: plain(row.balance_minor),
      lockedMinor: plain(row.locked_minor), frozen: row.is_frozen === true,
    })),
    paymentTotals: payments.map((row) => ({
      direction: row.direction, currency: row.currency, count: Number(row.total_count ?? 0),
      amountMinor: plain(row.total_minor),
    })),
    betting: bets.map((row) => ({
      currency: row.currency,
      openCount: Number(row.open_count ?? 0), closedCount: Number(row.closed_count ?? 0),
      openStakeMinor: plain(row.open_stake_minor), closedStakeMinor: plain(row.closed_stake_minor),
      payoutMinor: plain(row.payout_minor),
      // Profit is only for final settled / cashed-out wagers.
      // Positive customerNet means customer won; negative means site profit.
      customerNetMinor: (
        BigInt(plain(row.settled_payout_minor)) - BigInt(plain(row.settled_stake_minor))
      ).toString(),
      siteNetMinor: (
        BigInt(plain(row.settled_stake_minor)) - BigInt(plain(row.settled_payout_minor))
      ).toString(),
    })),
    casino,
    bonuses: bonuses.map((row) => {
      const expiresAt = iso(row.expires_at);
      const expired = expiresAt !== null && Date.parse(expiresAt) <= now;
      const status = String(row.status ?? '');
      return {
        id: row.id, title: row.title, currency: row.currency,
        amountMinor: plain(row.amount_minor), remainingMinor: plain(row.remaining_amount_minor),
        status: expired && ['active','locked'].includes(status) ? 'expired' : status,
        active: ['active','locked'].includes(status) && !expired,
        grantedAt: iso(row.granted_at), expiresAt,
      };
    }),
  });
});
