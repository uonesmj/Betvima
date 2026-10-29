import { ApiError, jsonOk, withErrorHandling } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { readWalletBalanceSnapshot } from '@/server/wallet/balance-snapshot';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Authenticated read-only balance for native header and active casino sessions.
 * No transactions, payment intents, provider callbacks, or monetary writes.
 */
export const GET = withErrorHandling('wallet.balance.get', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const wallet = await readWalletBalanceSnapshot(services.db, user.id, user.currency);
  if (!wallet) throw new ApiError('WALLET_NOT_FOUND', 'Wallet not initialized');
  const response = jsonOk({ wallet });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
});
