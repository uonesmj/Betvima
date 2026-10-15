import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { getDb } from '@/server/db';
import { casinoRealMoneyUserAllowed } from '@/server/providers/softaggregator/client';
import { casinoPlayerMayLaunch } from '@/server/providers/softaggregator/wallet';
import { fiatCasinoBalance } from '@/server/providers/softaggregator/fiat-wallet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Player-specific capability, never a client-supplied permission.
 * Off by default. Do not create balances or attempt wallet mutations.
 * The provider always plays in USD; the wallet continues in its native fiat.
 */
export const GET = withErrorHandling('casino.eligibility', async (ctx, request: Request) => {
  const { user } = await withUser(request, ctx);
  const walletCurrency = user.currency;
  const base = {
    currency: 'USD', walletCurrency, minStakeUsdMinor: '20',
    realMoneyEnabled: false, availableUsdMinor: '0',
  };
  if (!casinoRealMoneyUserAllowed(user.id)) {
    return NextResponse.json({ ok: true, data: base }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  try {
    await casinoPlayerMayLaunch(user.id);
    const db = getDb();
    let balance: bigint;
    if (walletCurrency === 'IRT' || walletCurrency === 'IRR') {
      const result = await fiatCasinoBalance(db, user.id);
      if (result.error !== 0) throw new Error('CASINO_BALANCE_NOT_AVAILABLE');
      balance = BigInt(result.balance);
    } else if (walletCurrency === 'USD') {
      const wallet = await db.queryOne<{
        balance_minor: string; locked_minor: string; is_frozen: boolean
      }>('select balance_minor::text, locked_minor::text, is_frozen from nova.wallets ' +
        'where user_id=$1 and currency=$2', [user.id, 'USD']);
      if (!wallet || wallet.is_frozen) throw new Error('CASINO_BALANCE_NOT_AVAILABLE');
      balance = BigInt(wallet.balance_minor) - BigInt(wallet.locked_minor);
    } else {
      throw new Error('CASINO_WALLET_CURRENCY_UNSUPPORTED');
    }
    if (balance < 0n || balance > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('CASINO_BALANCE_INVALID');
    }
    return NextResponse.json({ ok: true, data: {
      ...base, realMoneyEnabled: true, availableUsdMinor: balance.toString(),
    } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ ok: true, data: base }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
});
