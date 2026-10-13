/**
 * uWallet's UUSD -> HotVoucher swap quote is denominated in HotVoucher units
 * (IRR). It is a REFERENCE conversion, not a distinct bid/ask offer.
 * Financial consumers must never silently fall back to Arzhaam.
 */
import { ApiError } from '@/lib/errors';
import { getCoins } from './client';

export type VoucherFiatCurrency = 'IRT' | 'IRR';
const SCALE = 100000000n;

function scaledRate(rate: string): bigint {
  if (!/^\d{1,9}(?:\.\d{1,8})?$/.test(rate)) {
    throw new ApiError('BAD_REQUEST', 'Invalid uWallet voucher rate');
  }
  const [whole, fraction = ''] = rate.split('.');
  const n = BigInt(whole!) * SCALE + BigInt(fraction.padEnd(8, '0'));
  if (n < 100000n * SCALE || n > 100000000n * SCALE) {
    throw new ApiError('BAD_REQUEST', 'uWallet voucher rate out of bounds');
  }
  return n;
}

export async function getUwalletVoucherIrrPerUsd(): Promise<string> {
  const env = (await import('@/server/env')).serverEnv();
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
  scaledRate(rate);
  return rate;
}

export function voucherUsdToWalletMinor(usdMinor: bigint, walletCurrency: VoucherFiatCurrency, rate: string): bigint {
  if (usdMinor < 0n) throw new ApiError('BAD_REQUEST', 'Invalid voucher USD amount');
  const denom = (walletCurrency === 'IRT' ? 1000n : walletCurrency === 'IRR' ? 100n : 0n) * SCALE;
  if (!denom) throw new ApiError('BAD_REQUEST', 'Unsupported voucher wallet currency');
  const total = usdMinor * scaledRate(rate);
  return (total + denom / 2n) / denom;
}

export function voucherWalletToUsdMinor(walletMinor: bigint, walletCurrency: VoucherFiatCurrency, rate: string): bigint {
  if (walletMinor < 0n) throw new ApiError('BAD_REQUEST', 'Invalid voucher wallet amount');
  const multiplier = walletCurrency === 'IRT' ? 1000n : walletCurrency === 'IRR' ? 100n : 0n;
  if (!multiplier) throw new ApiError('BAD_REQUEST', 'Unsupported voucher wallet currency');
  // Floor to cents: never issue a voucher worth more than the user's request.
  return (walletMinor * multiplier * SCALE) / scaledRate(rate);
}

export function voucherWithdrawalDebit(requestedWalletMinor: bigint, currency: VoucherFiatCurrency, rate: string) {
  const usdMinor = voucherWalletToUsdMinor(requestedWalletMinor, currency, rate);
  const walletMinor = voucherUsdToWalletMinor(usdMinor, currency, rate);
  if (walletMinor > requestedWalletMinor) {
    throw new ApiError('BAD_REQUEST', 'Voucher quote rounding exceeded requested amount');
  }
  return { usdMinor, walletMinor };
}

export function assertVoucherRateStillCurrent(quotedRate: string, liveRate: string) {
  const quoted = scaledRate(quotedRate);
  const live = scaledRate(liveRate);
  // Narrow tolerance for ordinary market movement; quoted rate is still used
  // to create a transaction-consistent immutable snapshot.
  const delta = quoted > live ? quoted - live : live - quoted;
  if (delta * 10000n > live * 30n) {
    throw new ApiError('BAD_REQUEST', 'uWallet voucher rate changed. Refresh the quote and retry.');
  }
}
