import type { Db } from '@/lib/ports/db';

export type CasinoFinancialRow = {
  source: string;
  currency: string;
  rounds: number;
  stakeMinor: string;
  payoutMinor: string;
  refundMinor: string;
  netSiteMinor: string;
  netUserMinor: string;
};

/**
 * Read-only casino ledger projection. Keep sources and currencies separate.
 * SoftAggregator: only accepted, ledger-posted callbacks are counted.
 * Rollback credits are refunds, not gambling winnings.
 * The exact same projection powers admin casino overview and player dossier.
 */
export async function casinoFinance(db: Db, userId: string | null, since: Date | null): Promise<CasinoFinancialRow[]> {
  const [slots, external] = await Promise.all([
    db.query<Record<string, unknown>>(
      `select currency, count(*)::bigint as rounds,
              coalesce(sum(bet_minor),0)::bigint as stake_minor,
              coalesce(sum(win_minor),0)::bigint as payout_minor,
              0::bigint as refund_minor
         from nova.casino_slot_spins
        where status = 'completed'
          and ($1::uuid is null or user_id = $1)
          and ($2::timestamptz is null or created_at >= $2)
        group by currency order by currency`, [userId, since]),
    db.query<Record<string, unknown>>(
      `select wallet_currency as currency,
              count(distinct round_id) filter (where round_id is not null)::bigint as rounds,
              coalesce(sum(wallet_amount_minor) filter (where action = 'debit' and rollback = false),0)::bigint as stake_minor,
              coalesce(sum(wallet_amount_minor) filter (where action = 'credit' and rollback = false),0)::bigint as payout_minor,
              coalesce(sum(wallet_amount_minor) filter (where action = 'credit' and rollback = true),0)::bigint as refund_minor
         from nova.softaggregator_callback_receipts
        where response_error = 0 and ledger_transaction_id is not null
          and ($1::uuid is null or user_id = $1)
          and ($2::timestamptz is null or created_at >= $2)
        group by wallet_currency order by wallet_currency`, [userId, since]),
  ]);
  const asRows = (rows: Record<string, unknown>[], source: string): CasinoFinancialRow[] =>
    rows.map((r) => {
      const stake = BigInt(String(r.stake_minor ?? 0));
      const payout = BigInt(String(r.payout_minor ?? 0));
      const refund = BigInt(String(r.refund_minor ?? 0));
      const site = stake - payout - refund;
      return {
        source, currency: String(r.currency ?? ''),
        rounds: Number(r.rounds ?? 0),
        stakeMinor: stake.toString(), payoutMinor: payout.toString(),
        refundMinor: refund.toString(),
        netSiteMinor: site.toString(), netUserMinor: (-site).toString(),
      };
    });
  return [...asRows(slots,'internal_slots'),...asRows(external,'softaggregator')];
}
