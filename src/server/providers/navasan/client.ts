import { ApiError } from "@/lib/errors";

type NavasanRateItem = {
  value?: string | number;
  timestamp?: string | number;
  date?: string;
  change?: string | number;
};

type NavasanLatestResponse = Record<string, NavasanRateItem | undefined>;

export type NavasanRate = {
  item: string;
  value: string;
  timestamp: number | null;
  date: string | null;
};

function parseDecimal(value: string): { numerator: bigint; denominator: bigint } {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new ApiError("INTERNAL_ERROR", "Invalid Navasan FX rate");
  }
  const [whole = "", fraction = ""] = normalized.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator =
    BigInt(whole) * denominator +
    BigInt(fraction.length ? fraction : "0");
  return { numerator, denominator };
}

export function convertUsdMinorToIrrMinor(
  usdMinor: bigint,
  rate: string,
): bigint {
  if (usdMinor < 0n) {
    throw new ApiError("INTERNAL_ERROR", "USD amount cannot be negative");
  }
  const parsed = parseDecimal(rate);
  const numerator = usdMinor * parsed.numerator;
  const denominator = 100n * parsed.denominator;
  return (numerator + denominator / 2n) / denominator;
}

export function convertIrrMinorToUsdMinor(
  irrMinor: bigint,
  rate: string,
): bigint {
  if (irrMinor < 0n) {
    throw new ApiError("INTERNAL_ERROR", "IRR amount cannot be negative");
  }
  const parsed = parseDecimal(rate);
  const numerator = irrMinor * 100n * parsed.denominator;
  const denominator = parsed.numerator;
  return (numerator + denominator / 2n) / denominator;
}

/**
 * Convert USD cents to a native currency minor amount.
 *
 * Navasan currency rates are quoted in IRR per 1 unit of the foreign
 * currency. Therefore:
 *
 * USD -> IRR : USD * USD/IRR quote
 * USD -> IRT : USD * USD/IRR quote / 10
 * USD -> EUR : USD * USD/IRR quote / EUR/IRR quote
 * USD -> GBP : USD * USD/IRR quote / GBP/IRR quote
 */
export function convertUsdMinorToNativeMinor(
  usdMinor: bigint,
  nativeCurrency: string,
  usdIrrRate: string,
  nativeIrrRate?: string,
): bigint {
  if (usdMinor < 0n) {
    throw new ApiError("INTERNAL_ERROR", "USD amount cannot be negative");
  }

  if (nativeCurrency === "USD") return usdMinor;

  if (nativeCurrency === "IRR") {
    return convertUsdMinorToIrrMinor(usdMinor, usdIrrRate);
  }

  if (nativeCurrency === "IRT") {
    const irrMinor = convertUsdMinorToIrrMinor(usdMinor, usdIrrRate);
    return (irrMinor + 5n) / 10n;
  }

  if (nativeCurrency !== "EUR" && nativeCurrency !== "GBP") {
    throw new ApiError(
      "BAD_REQUEST",
      `Casino FX is not supported for currency ${nativeCurrency}`,
    );
  }

  if (!nativeIrrRate) {
    throw new ApiError(
      "INTERNAL_ERROR",
      `Navasan ${nativeCurrency} rate is unavailable`,
    );
  }

  const usd = parseDecimal(usdIrrRate);
  const native = parseDecimal(nativeIrrRate);

  // usdMinor is USD cents.
  // native major-unit value = usd major-unit value * usdIRR / nativeIRR.
  // EUR/GBP have 2 minor decimals.
  const numerator =
    usdMinor *
    usd.numerator *
    native.denominator;

  const denominator =
    100n *
    usd.denominator *
    native.numerator;

  return (numerator + denominator / 2n) / denominator;
}

export function convertNativeMinorToUsdMinor(
  nativeMinor: bigint,
  nativeCurrency: string,
  usdIrrRate: string,
  nativeIrrRate?: string,
): bigint {
  if (nativeMinor < 0n) {
    throw new ApiError("INTERNAL_ERROR", "Native amount cannot be negative");
  }

  if (nativeCurrency === "USD") return nativeMinor;

  if (nativeCurrency === "IRR") {
    return convertIrrMinorToUsdMinor(nativeMinor, usdIrrRate);
  }

  if (nativeCurrency === "IRT") {
    const irrMinor = nativeMinor * 10n;
    return convertIrrMinorToUsdMinor(irrMinor, usdIrrRate);
  }

  if (nativeCurrency !== "EUR" && nativeCurrency !== "GBP") {
    throw new ApiError(
      "BAD_REQUEST",
      `Casino FX is not supported for currency ${nativeCurrency}`,
    );
  }

  if (!nativeIrrRate) {
    throw new ApiError(
      "INTERNAL_ERROR",
      `Navasan ${nativeCurrency} rate is unavailable`,
    );
  }

  const usd = parseDecimal(usdIrrRate);
  const native = parseDecimal(nativeIrrRate);

  // nativeMinor is EUR/GBP cents.
  // USD cents = native major * nativeIRR / usdIRR * 100.
  const numerator =
    nativeMinor *
    native.numerator *
    usd.denominator;

  const denominator =
    native.denominator *
    usd.numerator;

  return (numerator + denominator / 2n) / denominator;
}

export function convertSignedNativeMinorToUsdMinor(
  nativeMinor: bigint,
  nativeCurrency: string,
  usdIrrRate: string,
  nativeIrrRate?: string,
): bigint {
  if (nativeMinor === 0n) return 0n;
  const negative = nativeMinor < 0n;
  const absolute = negative ? -nativeMinor : nativeMinor;
  const converted = convertNativeMinorToUsdMinor(
    absolute,
    nativeCurrency,
    usdIrrRate,
    nativeIrrRate,
  );
  return negative ? -converted : converted;
}

async function getLatestRate(item: string): Promise<NavasanRate> {
  const apiKey = process.env.NAVASAN_API_KEY?.trim();

  if (!apiKey) {
    throw new ApiError(
      "INTERNAL_ERROR",
      "Navasan FX provider is not configured",
    );
  }

  const cacheSeconds = Math.max(
    60,
    Number.parseInt(
      process.env.NAVASAN_RATE_CACHE_SECONDS ?? "7200",
      10,
    ) || 7200,
  );

  const cacheKey = `navasan:${item}`;
  const globalCache = globalThis as typeof globalThis & {
    __novaNavasanRates?: Map<
      string,
      { rate: NavasanRate; expiresAt: number }
    >;
  };

  globalCache.__novaNavasanRates ??= new Map();

  const cached = globalCache.__novaNavasanRates.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate;
  }

  const baseUrl = (
    process.env.NAVASAN_BASE_URL?.trim() ||
    "http://api.navasan.tech/latest/"
  ).replace(/\/+$/, "") + "/";

  const url = new URL(baseUrl);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("item", item);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ApiError("INTERNAL_ERROR", "Navasan FX request failed");
  }

  if (!response.ok) {
    throw new ApiError(
      "INTERNAL_ERROR",
      `Navasan FX request returned HTTP ${response.status}`,
    );
  }

  let payload: NavasanLatestResponse;

  try {
    payload = (await response.json()) as NavasanLatestResponse;
  } catch {
    throw new ApiError("INTERNAL_ERROR", "Invalid Navasan FX response");
  }

  const entry = payload[item];
  const value =
    entry?.value === undefined ? "" : String(entry.value).trim();

  if (!value) {
    throw new ApiError(
      "INTERNAL_ERROR",
      `Navasan ${item} rate is unavailable`,
    );
  }

  parseDecimal(value);

  const timestampRaw = entry?.timestamp;
  const timestamp =
    timestampRaw === undefined || timestampRaw === null
      ? null
      : Number(timestampRaw);

  const rate: NavasanRate = {
    item,
    value,
    timestamp: Number.isFinite(timestamp) ? timestamp : null,
    date: entry?.date ?? null,
  };

  globalCache.__novaNavasanRates.set(cacheKey, {
    rate,
    expiresAt: Date.now() + cacheSeconds * 1000,
  });

  return rate;
}

export async function getUsdSellRate(): Promise<NavasanRate> {
  return getLatestRate("usd_sell");
}

export async function getEurRate(): Promise<NavasanRate> {
  return getLatestRate("eur");
}

export async function getGbpRate(): Promise<NavasanRate> {
  return getLatestRate("gbp");
}

