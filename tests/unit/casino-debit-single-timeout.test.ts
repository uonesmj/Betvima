import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  calls: [] as string[],
  release: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: class FakePool {
    on() { return this; }
    async connect() {
      return {
        async query(sql: string) {
          fake.calls.push(sql.toLowerCase());
          return { rows: [{ answer: 1 }] };
        },
        release: fake.release,
      };
    }
    async end() { return; }
  },
}));

import { PostgresDb } from '../../src/server/db/postgres';

describe('SoftAggregator Debit scoped transaction timeout', () => {
  beforeEach(() => {
    fake.calls.length = 0;
    fake.release.mockClear();
  });

  it('preserves per-query timeout for normal transactions (including Credit/Refund)', async () => {
    const db = new PostgresDb({ connectionString: 'postgres://fake' });
    await db.transaction(async tx => {
      await tx.query('select 1');
      await tx.query('select 2');
    });
    expect(fake.calls.filter(sql => sql.startsWith('set local statement_timeout'))).toHaveLength(2);
    expect(fake.calls.at(0)).toBe('begin read write');
    expect(fake.calls.at(-1)).toBe('commit');
    expect(fake.release).toHaveBeenCalledOnce();
  });

  it('sets the same timeout only once for ordinary Debit', async () => {
    const db = new PostgresDb({ connectionString: 'postgres://fake' });
    await db.transactionForCasinoDebit(async tx => {
      await tx.query('select 1');
      await tx.query('select 2');
      await tx.query('select 3');
    });
    expect(fake.calls.filter(sql => sql.startsWith('set local statement_timeout'))).toEqual([
      'set local statement_timeout = 15000',
    ]);
    expect(fake.calls.at(-1)).toBe('commit');
    expect(fake.release).toHaveBeenCalledOnce();
  });

  it('honors custom per-query timeouts and restores the default in a debit transaction', async () => {
    const db = new PostgresDb({ connectionString: 'postgres://fake' });
    await db.transactionForCasinoDebit(async tx => {
      await tx.query('select 1', [], { timeoutMs: 3000 });
      await tx.query('select 2');
    });
    expect(fake.calls.filter(sql => sql.startsWith('set local statement_timeout'))).toEqual([
      'set local statement_timeout = 15000',
      'set local statement_timeout = 3000',
      'set local statement_timeout = 15000',
    ]);
  });

  it('rolls back and releases the client on Debit failure', async () => {
    const db = new PostgresDb({ connectionString: 'postgres://fake' });
    await expect(db.transactionForCasinoDebit(async tx => {
      await tx.query('select 1');
      throw new Error('simulate transaction failure');
    })).rejects.toThrow('simulate transaction failure');
    expect(fake.calls.at(-1)).toBe('rollback');
    expect(fake.release).toHaveBeenCalledOnce();
  });
});
