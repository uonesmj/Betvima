import {
  convertSignedNativeMinorToUsdMinor,
  getEurRate,
  getGbpRate,
} from '@/server/providers/navasan/client';
import { getUsdIrtRate } from '@/server/providers/arzhaam/client';

export type AdminUsdRates = {
  usdIrrRate: string;
  eurRate?: string;
  gbpRate?: string;
};

export async function getAdminUsdRates(currencies: string[]): Promise<AdminUsdRates> {
  const normalized = [...new Set(currencies.map((c) => c.toUpperCase()))];
  const needsUsdRate = normalized.some((c) => c !== 'USD');
  const needsEurRate = normalized.includes('EUR');
  const needsGbpRate = normalized.includes('GBP');

  const [usdRate, eurRate, gbpRate] = await Promise.all([
    needsUsdRate ? getUsdIrtRate() : Promise.resolve(null),
    needsEurRate ? getEurRate() : Promise.resolve(null),
    needsGbpRate ? getGbpRate() : Promise.resolve(null),
  ]);

  if (needsUsdRate && !usdRate?.value) {
    throw new Error('ADMIN_USD_RATE_UNAVAILABLE');
  }
  if (needsEurRate && !eurRate?.value) {
    throw new Error('ADMIN_EUR_RATE_UNAVAILABLE');
  }
  if (needsGbpRate && !gbpRate?.value) {
    throw new Error('ADMIN_GBP_RATE_UNAVAILABLE');
  }

  return {
    usdIrrRate: usdRate?.value ?? '',
    eurRate: eurRate?.value,
    gbpRate: gbpRate?.value,
  };
}

export function convertAdminAmountToUsd(
  amountMinor: bigint,
  currency: string,
  rates: AdminUsdRates,
): bigint {
  const normalized = currency.toUpperCase();

  if (normalized === 'USD') return amountMinor;

  if (normalized === 'IRT' || normalized === 'IRR') {
    return convertSignedNativeMinorToUsdMinor(amountMinor, normalized, rates.usdIrrRate);
  }

  if (normalized === 'EUR') {
    if (!rates.eurRate) throw new Error('ADMIN_EUR_RATE_UNAVAILABLE');
    return convertSignedNativeMinorToUsdMinor(amountMinor, normalized, rates.usdIrrRate, rates.eurRate);
  }

  if (normalized === 'GBP') {
    if (!rates.gbpRate) throw new Error('ADMIN_GBP_RATE_UNAVAILABLE');
    return convertSignedNativeMinorToUsdMinor(amountMinor, normalized, rates.usdIrrRate, rates.gbpRate);
  }

  throw new Error(`ADMIN_UNSUPPORTED_CURRENCY:${normalized}`);
}
