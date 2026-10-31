import {beforeEach, describe, expect, it, vi} from 'vitest';

const pg = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn();
  const poolQuery = vi.fn();
  const end = vi.fn();
  return {query,release,connect,poolQuery,end};
});

vi.mock('pg', () => ({
  Pool: class {
    connect = pg.connect;
    query = pg.poolQuery;
    end = pg.end;
    on() { return this; }
  },
}));

import {PostgresDb} from '@/server/db/postgres';

describe('Stage10 transaction-local statement_timeout RTT optimisation (candidate only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pg.query.mockImplementation(async () => ({rows: [{ok: 1}]}));
    pg.connect.mockImplementation(async () => ({query: pg.query, release: pg.release}));
    pg.poolQuery.mockImplementation(async () => ({rows: [{ok: 1}]}));
    pg.end.mockResolvedValue(undefined);
  });

  function sqlCalls(): string[] {
    return pg.query.mock.calls.map(([sql]) => String(sql));
  }

  it('sets timeout once for sequential financial statements in the same transaction', async () => {
    const db = new PostgresDb({statementTimeoutMs: 15000});
    const ret = await db.transaction(async tx => {
      const first = await tx.query('SELECT one FROM ledger WHERE id=$1', [2]);
      const second = await tx.queryOne('SELECT two FROM receipts WHERE id=$1', [3]);
      await tx.rpc('stage10_readonly_fixture', {p_nonce: 'testnonce'});
      return [first,second];
    });
    expect(ret).toHaveLength(2);
    const statements = sqlCalls();
    expect(statements).toEqual([
      'begin read write',
      'set local statement_timeout = 15000',
      'SELECT one FROM ledger WHERE id=$1',
      'SELECT two FROM receipts WHERE id=$1',
      'select * from nova.stage10_readonly_fixture(p_nonce => $1)',
      'commit',
    ]);
    expect(pg.query.mock.calls[2]?.[1]).toEqual([2]);
    expect(pg.query.mock.calls[3]?.[1]).toEqual([3]);
    expect(pg.release).toHaveBeenCalledTimes(1);
  });

  it('reapplies timeout whenever requested duration changes, including returning to default', async () => {
    const db = new PostgresDb({statementTimeoutMs: 15000});
    await db.transaction(async tx => {
      await tx.query('SELECT a');
      await tx.query('SELECT b', [], {timeoutMs: 2200});
      await tx.query('SELECT c', [], {timeoutMs: 2200});
      await tx.query('SELECT d');
    });
    const sets = sqlCalls().filter(s => s.startsWith('set local statement_timeout'));
    expect(sets).toEqual([
      'set local statement_timeout = 15000',
      'set local statement_timeout = 2200',
      'set local statement_timeout = 15000',
    ]);
    expect(sqlCalls()).toContain('commit');
  });

  it('retains minimum 1000ms timeout when an overriding deadline is too low', async () => {
    const db = new PostgresDb({statementTimeoutMs: 15000});
    await db.transaction(async tx => tx.query('SELECT 1', [], {timeoutMs: 20}));
    expect(sqlCalls()).toContain('set local statement_timeout = 1000');
  });

  it('invalidates cache after caller changes transaction SQL settings explicitly', async () => {
    const db = new PostgresDb({statementTimeoutMs: 15000});
    await db.transaction(async tx => {
      await tx.query('SELECT first');
      await tx.query('SET LOCAL statement_timeout = 7000');
      await tx.query('SELECT third');
    });
    expect(sqlCalls().filter(s => s === 'set local statement_timeout = 15000')).toHaveLength(2);
    expect(sqlCalls()).toContain('SET LOCAL statement_timeout = 7000');
  });

  it('rolls back query failures and releases the database client', async () => {
    pg.query.mockImplementation(async sql => {
      if (sql === 'SELECT failing') throw new Error('db-unavailable');
      return {rows: []};
    });
    const db = new PostgresDb({statementTimeoutMs: 15000});
    await expect(db.transaction(tx => tx.query('SELECT failing'))).rejects.toThrow('db-unavailable');
    expect(sqlCalls().at(-1)).toBe('rollback');
    expect(sqlCalls()).not.toContain('commit');
    expect(pg.release).toHaveBeenCalledTimes(1);
  });

  it('cannot reuse timeout state across distinct database transactions', async () => {
    const db = new PostgresDb({statementTimeoutMs: 15000});
    await db.transaction(tx => tx.query('SELECT first'));
    await db.transaction(tx => tx.query('SELECT second'));
    expect(sqlCalls().filter(s => s === 'set local statement_timeout = 15000')).toHaveLength(2);
    expect(pg.release).toHaveBeenCalledTimes(2);
  });

  it('does not add SET LOCAL outside transactions or change the direct Pool query path', async () => {
    const db = new PostgresDb({statementTimeoutMs: 15000});
    await db.query('SELECT public read');
    expect(pg.poolQuery).toHaveBeenCalledWith('SELECT public read', []);
    expect(sqlCalls()).toHaveLength(0);
  });
});
