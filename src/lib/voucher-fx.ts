/** Exact provider reference-FX calculations shared by UI and financial backend. */
import { ApiError } from '@/lib/errors/api-error';

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

export function voucherUsdToWalletMinor(usdMinor: bigint, walletCurrency: VoucherFiatCurrency, rate: string): bigint {
  if (usdMinor < 0n) throw new ApiError('BAD_REQUEST', 'Invalid voucher USD amount');
  const denom = (walletCurrency === 'IRT' ? 1000n : walletCurrency === 'IRR' ? 100n : 0n) * SCALE;
  if (!denom) throw new ApiError('BAD_REQUEST', 'Unsupported voucher wallet currency');
  const total = usdMinor * scaledRate(rate);
  return (total + denom / 2n) / denom;
}

/** Smallest wallet-unit debit that can issue the requested USD cents.
 * Using a rounded display quote here can fall one unit below the payout minimum.
 */
export function voucherMinimumWalletMinor(usdMinor: bigint, walletCurrency: VoucherFiatCurrency, rate: string): bigint {
  if (usdMinor < 0n) throw new ApiError('BAD_REQUEST', 'Invalid voucher USD amount');
  const denom = (walletCurrency === 'IRT' ? 1000n : walletCurrency === 'IRR' ? 100n : 0n) * SCALE;
  if (!denom) throw new ApiError('BAD_REQUEST', 'Unsupported voucher wallet currency');
  const numerator = usdMinor * scaledRate(rate);
  return (numerator + denom - 1n) / denom;
}

/** Voucher forms display rial even when a legacy wallet is stored in toman. */
export function voucherWalletMinorToIrr(walletMinor: bigint, currency: VoucherFiatCurrency): bigint {
  if (walletMinor < 0n) throw new ApiError('BAD_REQUEST', 'Invalid voucher wallet amount');
  return currency === 'IRT' ? walletMinor * 10n : currency === 'IRR' ? walletMinor : unsupportedCurrency();
}

export function voucherIrrToWalletMinor(irrAmount: bigint, currency: VoucherFiatCurrency): bigint {
  if (irrAmount < 0n) throw new ApiError('BAD_REQUEST', 'Invalid voucher IRR amount');
  if (currency === 'IRR') return irrAmount;
  if (currency !== 'IRT') return unsupportedCurrency();
  if (irrAmount % 10n !== 0n) throw new ApiError('BAD_REQUEST', 'Rial amount must be a multiple of 10 for toman wallets');
  return irrAmount / 10n;
}

function unsupportedCurrency(): never {
  throw new ApiError('BAD_REQUEST', 'Unsupported voucher wallet currency');
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
