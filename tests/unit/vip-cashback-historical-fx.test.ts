import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchArzhaamHistoricalUsd, syncVipHistoricalFx } from '../../src/server/providers/arzhaam/history';
import type { Db } from '../../src/lib/ports/db';
const nativeFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv('ARZHAAM_API_KEY','test-only-not-real');
});
afterEach(() => {
  global.fetch = nativeFetch;
  vi.unstubAllEnvs();
});

const good = {
  assetId: 'usd',
  range: '30d',
  points: [{ timestamp: '2026-10-14T05:00:00.000Z', price: 150000.25 }],
  meta: { currency: 'toman' },
};

describe('historical FX provider financial safety', () => {
  it('accepts precisely timestamped USD/toman history with no float money math', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(good),
    } as Partial<Response>);
    expect(await fetchArzhaamHistoricalUsd('30d')).toEqual([
      { timestamp: '2026-10-14T05:00:00.000Z', price: '150000.25' },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://arzhaam.ir/api/rates/history/usd?range=30d',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-App-Key': 'test-only-not-real' }) }),
    );
  });

  it('refuses incompatible units, point timestamps and provider errors', async () => {
    for (const body of [
      { ...good, meta: { currency: 'rial' } },
      { ...good, points: [{ timestamp: 'invalid', price: 150000 }] },
      { ...good, points: [{ timestamp: '2026-10-14T05:00:00Z', price: -1 }] },
      { ...good, points: [{ timestamp: '2026-10-14T05:00:00Z', price: 0 }] },
      { ...good, points: [] },
    ]) {
      global.fetch = vi.fn().mockResolvedValue({ ok:true,text:async()=>JSON.stringify(body) } as Partial<Response>);
      await expect(fetchArzhaamHistoricalUsd('30d')).rejects.toThrow();
    }
    global.fetch = vi.fn().mockResolvedValue({ ok:false,status:403 } as Partial<Response>);
    await expect(fetchArzhaamHistoricalUsd('30d')).rejects.toThrow('VIP_FX_PROVIDER_HTTP_403');
  });

  it('only ingests samples returned by the trusted provider, and never credits a wallet', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok:true,text:async()=>JSON.stringify(good) } as Partial<Response>);
    const rpc = vi.fn().mockResolvedValue(1);
    const db = { rpc } as unknown as Db;
    const result=await syncVipHistoricalFx(db,'30d');
    expect(result).toEqual({ fetched:1,inserted:1,range:'30d' });
    expect(rpc).toHaveBeenCalledWith('vip_cb_ingest_fx_history', {
      p_range:'30d',
      p_points:[{ timestamp:'2026-10-14T05:00:00.000Z',price:'150000.25' }],
    }, { timeoutMs:60000 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
