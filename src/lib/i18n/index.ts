import type { Locale } from './dictionaries';
import { LOCALES, DEFAULT_LOCALE, isRtl, translate, DICTIONARIES } from './dictionaries';

export { LOCALES, DEFAULT_LOCALE, isRtl, translate, DICTIONARIES } from './dictionaries';
export type { Locale } from './dictionaries';

export function formatMinor(
  amountMinor: bigint | string,
  currency = 'IRT',
  _locale: Locale = DEFAULT_LOCALE,
): string {
  const value = typeof amountMinor === 'bigint' ? amountMinor : BigInt(amountMinor);
  const divisor = currency === 'IRT' || currency === 'IRR' ? 1n : 100n;
  const whole = value / divisor;
  const fraction = value % divisor;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const withFraction =
    divisor === 1n || fraction === 0n
      ? grouped
      : `${grouped}.${fraction.toString().padStart(2, '0')}`;
  return `${withFraction} ${currency}`;
}

export function formatOddsScaled(oddsScaled: bigint | string): string {
  const value = typeof oddsScaled === 'bigint' ? oddsScaled : BigInt(oddsScaled);
  const whole = value / 10_000n;
  const fraction = value % 10_000n;
  const decimals =
    fraction === 0n
      ? '00'
      : fraction.toString().padStart(4, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${decimals}`;
}

export function formatDateTime(
  iso: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
  timeZone = 'Asia/Tehran',
): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone,
      calendar: 'gregory',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatRelative(
  iso: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatter = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
    calendar: 'gregory',
  });
  return formatter.format(date);
}
