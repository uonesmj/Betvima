import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  casinoSqlLabel, measureCasinoDb, traceCasinoCallback,
} from '@/server/providers/softaggregator/perf-trace';

afterEach(() => vi.unstubAllEnvs());

describe('isolated, opt-in callback timings', () => {
  it('leaves callback response and financial work untouched when disabled', async () => {
    vi.stubEnv('SOFTAGGREGATOR_CALLBACK_PERF_TRACE', 'false');
    const logger = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const value = await traceCasinoCallback('debit', false,
        () => measureCasinoDb('db.ledger', async () => ({ error: 0, balance: 9750 })));
      expect(value).toEqual({ error: 0, balance: 9750 });
      expect(logger).not.toHaveBeenCalled();
    } finally { logger.mockRestore(); }
  });

  it('logs only fixed stage names and times, never SQL or financial values', async () => {
    vi.stubEnv('SOFTAGGREGATOR_CALLBACK_PERF_TRACE', 'true');
    const logger = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const value = await traceCasinoCallback('debit', false, async () => {
        await measureCasinoDb('db.pool.acquire', async () => undefined);
        await measureCasinoDb('db.ledger', async () => undefined);
        return { error: 0, balance: 9750 };
      });
      expect(value.balance).toBe(9750);
      expect(logger).toHaveBeenCalledOnce();
      const entry = JSON.parse(String(logger.mock.calls[0]?.[0]));
      expect(entry).toMatchObject({
        event: 'casino.callback.latency', action: 'debit',
        rollback: false, outcome: 'completed',
      });
      expect(entry.total_ms).toBeGreaterThanOrEqual(0);
      expect(entry.phases['db.ledger']).toMatchObject({ count: 1 });
      expect(entry.phases['db.pool.acquire']).toMatchObject({ count: 1 });
      const safe = JSON.stringify(entry);
      for (const sensitive of ['9750', 'call_id', 'username', 'round_id', 'player_1',
        'SOFTAGGREGATOR_SALT_KEY', 'postgresql://']) {
        expect(safe).not.toContain(sensitive);
      }
    } finally { logger.mockRestore(); }
  });

  it('records timing on a failed callback while preserving the error', async () => {
    vi.stubEnv('SOFTAGGREGATOR_CALLBACK_PERF_TRACE', 'true');
    const logger = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await expect(traceCasinoCallback('credit', false, async () => {
        await measureCasinoDb('db.receipt', async () => {
          throw new Error('DB_TIMEOUT');
        });
      })).rejects.toThrow('DB_TIMEOUT');
      const logged = JSON.parse(String(logger.mock.calls[0]?.[0]));
      expect(logged.outcome).toBe('failed');
      expect(JSON.stringify(logged)).not.toContain('DB_TIMEOUT');
    } finally { logger.mockRestore(); }
  });

  it('uses only static labels for SQL text', () => {
    expect(casinoSqlLabel('select pg_advisory_xact_lock(hashtext($1))')).toBe('db.lock');
    expect(casinoSqlLabel('select * from nova.post_wallet_entry(p_user_id => $1)')).toBe('db.ledger');
    expect(casinoSqlLabel('insert into nova.softaggregator_callback_receipts values($1)')).toBe('db.receipt');
    expect(casinoSqlLabel('select * from arbitrary_table where secret=123456')).toBe('db.other');
  });
});
