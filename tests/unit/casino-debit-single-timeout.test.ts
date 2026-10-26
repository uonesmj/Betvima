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

describe('SoftAggregator signed callback scoped transaction timeout', () => {
  beforeEach(() => {
    fake.calls.length = 0;
    fake.release.mockClear();
  });

  it('preserves per-query timeout for ordinary transactions (including refund, unrelated financial operations)', async () => {
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

  it('sets the same timeout only once for ordinary Debit and Credit callbacks', async () => {
    const db = new PostgresDb({ connectionString: 'postgres://fake' });
    await db.transactionForCasinoCallback(async tx => {
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

  it('honors custom per-query timeouts and restores the default in a signed callback transaction', async () => {
    const db = new PostgresDb({ connectionString: 'postgres://fake' });
    await db.transactionForCasinoCallback(async tx => {
      await tx.query('select 1', [], { timeoutMs: 3000 });
      await tx.query('select 2');
    });
    expect(fake.calls.filter(sql => sql.startsWith('set local statement_timeout'))).toEqual([
      'set local statement_timeout = 15000',
      'set local statement_timeout = 3000',
      'set local statement_timeout = 15000',
    ]);
  });

  it('continues honoring a 15-second timeout after write operations without resetting it', async () => {
    const db = new PostgresDb({ connectionString: 'postgres://fake' });
    await db.transactionForCasinoCallback(async tx => {
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['lock']);
      await tx.query('insert into nova.wallets(user_id,currency,balance_minor) values ($1,$2,$3) on conflict do nothing', ['x', 'USD', 0]);
      await tx.query('select 1 from nova.wallets where user_id=$1 for update', ['x']);
      await tx.rpc('post_wallet_entry', { p_user_id: 'x', p_amount_minor: '-10' });
      await tx.query('insert into nova.softaggregator_callback_receipts(call_id) values ($1)', ['abc']);
    });
    expect(fake.calls.filter(sql => sql.startsWith('set local statement_timeout'))).toEqual([
      'set local statement_timeout = 15000',
    ]);
    expect(fake.calls.at(-1)).toBe('commit');
  });

  it('rolls back and releases the client on callback failure', async () => {
    const db = new PostgresDb({ connectionString: 'postgres://fake' });
    await expect(db.transactionForCasinoCallback(async tx => {
      await tx.query('select 1');
      throw new Error('simulate transaction failure');
    })).rejects.toThrow('simulate transaction failure');
    expect(fake.calls.at(-1)).toBe('rollback');
    expect(fake.release).toHaveBeenCalledOnce();
  });
});
