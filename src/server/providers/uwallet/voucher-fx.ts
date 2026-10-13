/** Provider uWallet reference rate (UUSD -> IRR HotVoucher units). */
import { ApiError } from '@/lib/errors';
import { serverEnv } from '@/server/env';
import { getCoins } from './client';
import { voucherUsdToWalletMinor } from '@/lib/voucher-fx';

export {
  voucherUsdToWalletMinor,
  voucherWalletToUsdMinor,
  voucherWithdrawalDebit,
  assertVoucherRateStillCurrent,
} from '@/lib/voucher-fx';
export type { VoucherFiatCurrency } from '@/lib/voucher-fx';

export async function getUwalletVoucherIrrPerUsd(): Promise<string> {
  const env = serverEnv();
  const coins = await getCoins();
  const usd = coins.find(c => String(c.coin ?? c.symbol ?? '').toLowerCase() === env.uwalletUvoucherCoin.toLowerCase()
    || String(c.symbol ?? c.coin ?? '').toLowerCase() === env.uwalletUvoucherCoin.toLowerCase());
  const swap = usd?.swap?.find(s => String(s.coin ?? '').toLowerCase() === env.uwalletHotvoucherCoin.toLowerCase());
  const percent = String(swap?.percent ?? '');
  if (!/^\d+(?:\.\d{1,10})?$/.test(percent)) {
    throw new ApiError('PAYMENT_PROVIDER_DISABLED', 'uWallet voucher reference rate is unavailable');
  }
  // Provider returns percent (e.g. 252706220 => 2527062.20 IRR/USD).
  const numeric = Number(percent) / 100;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new ApiError('PAYMENT_PROVIDER_DISABLED', 'Invalid uWallet voucher reference rate');
  }
  const rate = numeric.toFixed(8);
  // Validate through the exact server/client conversion routine.
  voucherUsdToWalletMinor(100n, 'IRR', rate);
  return rate;
}

