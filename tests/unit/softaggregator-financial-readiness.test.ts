import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import { casinoFinancialSchemaReady } from '@/server/providers/softaggregator/financial-readiness';

describe('SoftAggregator live-wallet release schema gate', () => {
  it('refuses real-money if the DB is missing financial migrations', async () => {
    const db = { queryOne: vi.fn().mockResolvedValue({ ready: false }) };
    expect(await casinoFinancialSchemaReady(db as unknown as Db)).toBe(false);
    expect(db.queryOne).toHaveBeenCalledOnce();
    const sql = db.queryOne.mock.calls[0]![0] as string;
    for (const required of [
      'softaggregator_callback_receipts',
      'softaggregator_round_fx',
      'sa_unique_reversed_debit',
      'sa_unique_reversed_credit',
      'original_credit_call_id',
      'sa_fx_round_immutable',
      'sa_receipt_immutable',
    ]) expect(sql).toContain(required);
  });

  it('accepts fully migrated active audit schema', async () => {
    const db = { queryOne: vi.fn().mockResolvedValue({ ready: true }) };
    expect(await casinoFinancialSchemaReady(db as unknown as Db)).toBe(true);
  });

  it('fails closed on SQL errors, unavailable DB, or missing result', async () => {
    for (const response of [null, {}, { ready: null }, { ready: 'true' }]) {
      const db = { queryOne: vi.fn().mockResolvedValue(response) };
      expect(await casinoFinancialSchemaReady(db as unknown as Db)).toBe(false);
    }
    const failing = { queryOne: vi.fn().mockRejectedValue(new Error('pool unavailable')) };
    expect(await casinoFinancialSchemaReady(failing as unknown as Db)).toBe(false);
  });
});
