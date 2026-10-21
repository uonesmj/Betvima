import { formatMinor } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

/**
 * Royal Vault shows a real wallet as READ-ONLY context.
 * Never convert this snapshot into wager authorization: a balance is not a
 * reservation, and this endpoint never debits or settles any funds.
 */
export type OriginalsWalletSnapshot = Readonly<{
  currency: 'USD' | 'IRR' | 'IRT';
  availableMinor: string;
  availableFormatted: string;
}>;

type WalletData = {
  wallet?: {
    currency?: unknown;
    availableMinor?: unknown;
  } | null;
  integrity?: unknown;
};

const NONNEGATIVE_MINOR = /^(0|[1-9][0-9]{0,29})$/;

export function parseOriginalsWalletSnapshot(
  payload: unknown,
  expectedCurrency: string,
  locale: Locale,
): OriginalsWalletSnapshot {
  if (!payload || typeof payload !== 'object') throw new Error('ORIGINALS_WALLET_MALFORMED');
  const envelope = payload as { ok?: unknown; data?: unknown };
  if (envelope.ok !== true || !envelope.data || typeof envelope.data !== 'object') {
    throw new Error('ORIGINALS_WALLET_RESPONSE_FAILED');
  }
  const response = envelope.data as WalletData;
  const wallet = response.wallet;
  if (response.integrity !== 'ok' || !wallet || typeof wallet !== 'object') {
    throw new Error('ORIGINALS_WALLET_UNVERIFIED');
  }
  const currency = wallet.currency;
  if (currency !== 'USD' && currency !== 'IRR' && currency !== 'IRT') {
    throw new Error('ORIGINALS_WALLET_CURRENCY_UNSUPPORTED');
  }
  if (currency !== expectedCurrency) throw new Error('ORIGINALS_WALLET_CURRENCY_MISMATCH');
  const minor = wallet.availableMinor;
  if (typeof minor !== 'string' || !NONNEGATIVE_MINOR.test(minor)) {
    throw new Error('ORIGINALS_WALLET_AMOUNT_INVALID');
  }
  return Object.freeze({
    currency,
    availableMinor: minor,
    availableFormatted: formatMinor(BigInt(minor), currency, locale),
  });
}
