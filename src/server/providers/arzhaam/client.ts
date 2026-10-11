import { ApiError } from '@/lib/errors';

type ArzhaamRate = {
  assetId?: string;
  price?: number | string;
  updatedAt?: string;
};


export type ArzhaamUsdRate = {
  value: string;
  timestamp: string | null;
};

function parsePositiveRate(value: unknown): string {
  const rate = typeof value === 'number' ? String(value) : String(value ?? '').trim();

  if (!/^\d+(?:\.\d+)?$/.test(rate) || Number(rate) <= 0) {
    throw new ApiError('INTERNAL_ERROR', 'Invalid Arzhaam USD rate');
  }

  return rate;
}

export async function getUsdIrtRate(): Promise<ArzhaamUsdRate> {
  const apiKey = process.env.ARZHAAM_API_KEY?.trim();

  if (!apiKey) {
    throw new ApiError('INTERNAL_ERROR', 'Arzhaam FX provider is not configured');
  }

  const response = await fetch('https://arzhaam.ir/api/rates/latest/usd', {
    method: 'GET',
    headers: {
      'X-App-Key': apiKey,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiError(
      'INTERNAL_ERROR',
      `Arzhaam FX request failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as ArzhaamRate;

  if (payload.assetId !== 'usd') {
    throw new ApiError('INTERNAL_ERROR', 'Arzhaam USD rate is unavailable');
  }

  return {
    value: parsePositiveRate(payload.price),
    timestamp: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
  };
}

export function convertUsdMinorToIrrMinor(
  usdMinor: bigint,
  usdIrtRate: string,
): bigint {
  const rate = Number(usdIrtRate);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new ApiError('INTERNAL_ERROR', 'Invalid USD/IRR rate');
  }

  return BigInt(Math.round(Number(usdMinor) * rate / 10));
}

export function convertIrrMinorToUsdMinor(
  irrMinor: bigint,
  usdIrtRate: string,
): bigint {
  const rate = Number(usdIrtRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new ApiError('INTERNAL_ERROR', 'Invalid USD/IRR rate');
  }
  if (irrMinor < 0n) {
    throw new ApiError('BAD_REQUEST', 'Invalid IRR amount');
  }
  // Arzhaam rate is toman per USD. IRR minor is 1/10 IRR.
  // USD minor = IRR minor * 10 / rate.
  return (irrMinor * 10n) / BigInt(Math.round(rate));
}

export function convertUsdMinorToIrtMinor(
  usdMinor: bigint,
  usdIrtRate: string,
): bigint {
  const rate = Number(usdIrtRate);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new ApiError('INTERNAL_ERROR', 'Invalid USD/IRT rate');
  }

  return BigInt(Math.round(Number(usdMinor) * rate / 100));
}
