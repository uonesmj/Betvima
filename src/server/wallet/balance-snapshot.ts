import type { Db } from '@/lib/ports/db';

export interface BalanceSnapshot {
  currency: string;
  balanceMinor: string;
  heldMinor: string;
  availableMinor: string;
  version: string;
}

/**
 * Canonical, lightweight header read.
 * The same atomic nova.wallets row is updated by wallet ledger callbacks.
 * Never recompute money from game events on the client.
 */
export async function readWalletBalanceSnapshot(
  db: Db, userId: string, currency: string
): Promise<BalanceSnapshot | null> {
  return db.queryOne<BalanceSnapshot>(
    `select currency,
            balance_minor::text as "balanceMinor",
            locked_minor::text as "heldMinor",
            greatest(balance_minor-locked_minor, 0)::text as "availableMinor",
            version::text as "version"
       from nova.wallets
      where user_id = $1 and currency = $2
      limit 1`,
    [userId, currency]
  );
}
