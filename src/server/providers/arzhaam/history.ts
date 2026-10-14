/**
 * Arzhaam historical USD rates in TOMAN. Only verified server-side use:
 *  - Price/point timestamps are supplied by the provider over HTTPS.
 *  - Never accept client-supplied FX data for actual wallet accounting.
 *  - Missing, conflicting, future or stale historical data fail closed.
 */
import type { Db } from '@/lib/ports/db';

type ProviderHistory = {
  assetId?: unknown; range?: unknown;
  points?: unknown;
  meta?: { currency?: unknown };
};

export type HistoricalUsdRatePoint = {
  timestamp: string;
  price: string;
};

export async function fetchArzhaamHistoricalUsd(
  range: '7d' | '30d' | '90d' = '30d',
): Promise<HistoricalUsdRatePoint[]> {
  const key = process.env.ARZHAAM_API_KEY?.trim();
  if (!key) throw new Error('VIP_FX_ARZHAAM_CREDENTIAL_MISSING');
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 15000);
  let response: Response;
  try {
    response = await fetch('https://arzhaam.ir/api/rates/history/usd?range=' + range, {
      method: 'GET',
      headers: { 'X-App-Key': key, Accept: 'application/json' },
      cache: 'no-store',
      signal: abort.signal,
    });
    if (!response.ok) throw new Error('VIP_FX_PROVIDER_HTTP_' + response.status);
    const raw = await response.text();
    if (raw.length > 1_000_000) throw new Error('VIP_FX_PROVIDER_RESPONSE_TOO_LARGE');
    const body = JSON.parse(raw) as ProviderHistory;
    if (body.assetId !== 'usd' || body.range !== range ||
        body.meta?.currency !== 'toman' || !Array.isArray(body.points) ||
        body.points.length === 0 || body.points.length > 2500) {
      throw new Error('VIP_FX_PROVIDER_INVALID_HISTORY');
    }
    const now = Date.now();
    const points = body.points.map((item: unknown) => {
      if (typeof item !== 'object' || item === null ||
          !('timestamp' in item) || !('price' in item)) {
        throw new Error('VIP_FX_INVALID_PRICE_POINT');
      }
      const point = item as { timestamp: unknown; price: unknown };
      const timestamp = point.timestamp;
      const price = String(point.price);
      if (typeof timestamp !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T/.test(timestamp) ||
          !Number.isFinite(Date.parse(timestamp)) ||
          Date.parse(timestamp) > now + 60_000 ||
          Date.parse(timestamp) < now - 100 * 86400_000 ||
          !/^\d{1,12}(?:\.\d{1,6})?$/.test(price) ||
          !/[^0.]/.test(price)) {
        throw new Error('VIP_FX_INVALID_PRICE_POINT');
      }
      return { timestamp: new Date(timestamp).toISOString(), price };
    });
    if (new Set(points.map(p => p.timestamp)).size !== points.length) {
      throw new Error('VIP_FX_DUPLICATE_SOURCE_TIMESTAMP');
    }
    return points;
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncVipHistoricalFx(
  db: Db, range: '7d' | '30d' | '90d' = '30d',
): Promise<{ fetched: number; inserted: number; range: string }> {
  const points = await fetchArzhaamHistoricalUsd(range);
  const inserted = await db.rpc<number>('vip_cb_ingest_fx_history', {
    p_points: points,
    p_range: range,
  }, { timeoutMs: 60_000 });
  if (!Number.isInteger(Number(inserted)) || Number(inserted) < 0 ||
      Number(inserted) > points.length) throw new Error('VIP_FX_INGEST_UNVERIFIED');
  return { fetched: points.length, inserted: Number(inserted), range };
}
