import type { Db } from '@/lib/ports/db';

export type CasinoNativeCurrency = 'USD' | 'IRT' | 'IRR';
const supported = new Set(['USD', 'IRT', 'IRR']);

export function isCasinoNativeCurrency(value: string): value is CasinoNativeCurrency {
  return supported.has(value);
}

/**
 * A callback does not carry a trusted session ID, so binding only a *round*
 * is insufficient: the user can change preferred_currency after launching a
 * game and before the first provider debit. Bind once before getGame.
 *
 * Immutable DB trigger and a transactionally locked insert prevent races and
 * silent re-denomination. Returning users must reselect their original native
 * wallet before opening another session; existing wins still settle there.
 */
export async function bindCasinoPlayerWallet(
  db: Db, userId: string, currency: string,
): Promise<CasinoNativeCurrency> {
  if (!isCasinoNativeCurrency(currency)) throw new Error('CASINO_WALLET_CURRENCY_UNSUPPORTED');
  return db.transaction(async (tx) => {
    // Serialize with concurrent preferred_currency updates before binding.
    const profile = await tx.queryOne<{ currency: string }>(
      'select preferred_currency::text as currency from nova.profiles where id=$1 for share',
      [userId],
    );
    if (!profile || profile.currency !== currency) throw new Error('CASINO_WALLET_CURRENCY_CHANGED');
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', [
      'softaggregator-player-binding:' + userId,
    ]);
    const existing = await tx.queryOne<{ wallet_currency: string }>(
      'select wallet_currency from nova.softaggregator_player_wallet_bindings where user_id=$1',
      [userId],
    );
    if (existing) {
      if (existing.wallet_currency !== currency) throw new Error('CASINO_WALLET_CURRENCY_LOCKED');
      return currency;
    }
    await tx.query(
      'insert into nova.softaggregator_player_wallet_bindings(user_id,wallet_currency) values($1,$2)',
      [userId, currency],
    );
    return currency;
  });
}

export async function readCasinoPlayerWallet(
  db: Pick<Db, 'queryOne'>, userId: string,
): Promise<CasinoNativeCurrency | null> {
  const row = await db.queryOne<{ wallet_currency: string }>(
    'select wallet_currency from nova.softaggregator_player_wallet_bindings where user_id=$1',
    [userId],
  );
  return row && isCasinoNativeCurrency(row.wallet_currency) ? row.wallet_currency : null;
}
