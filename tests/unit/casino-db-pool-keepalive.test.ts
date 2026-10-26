import { describe, expect, it, vi } from 'vitest';

const recorded = vi.hoisted(() => ({ poolOptions: {} as Record<string, unknown> }));

vi.mock('pg', () => ({
  Pool: class FakePool {
    constructor(options: Record<string, unknown>) {
      recorded.poolOptions = options;
    }
    on() { return this; }
    async end() { return; }
  },
}));

import { PostgresDb } from '@/server/db/postgres';

describe('casino callback remote Postgres connection reuse', () => {
  it('retains default max connections and timeouts while extending idle connection lifetime', async () => {
    const db = new PostgresDb({ connectionString: 'postgresql://fake:fake@localhost/fake' });
    expect(recorded.poolOptions).toMatchObject({
      max: 10,
      idleTimeoutMillis: 120_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    await db.close();
  });
});
