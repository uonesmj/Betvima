import { afterEach, describe, expect, it, vi } from 'vitest';
import { hostname } from 'node:os';
import { PostgresJobRepository } from '@/server/adapters/postgres/jobs';
import type { Db } from '@/lib/ports/db';

describe('worker heartbeat location', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('records the actual OS hostname even when the inherited environment is stale', async () => {
    vi.stubEnv('HOSTNAME', 'old-server-from-copied-env');
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresJobRepository({ query } as unknown as Db);
    await repository.heartbeat({ workerId: 'mock-worker', queue: 'odds-live', status: 'idle', processedCount: 0, failedCount: 0, staleAfterSeconds: 30 });
    const [sql, values] = query.mock.calls[0]!;
    expect(values[2]).toBe(hostname());
    expect(JSON.parse(values[4]).pid).toBe(process.pid);
    expect(sql).toContain('hostname = excluded.hostname');
    expect(sql).toContain('version = excluded.version');
  });

  it('keeps runtime identity and counters authoritative over optional metrics', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresJobRepository({ query } as unknown as Db);
    await repository.heartbeat({ workerId: 'mock-worker', queue: 'odds', status: 'idle', processedCount: 7, failedCount: 1, staleAfterSeconds: 30, metrics: { pid: -1, status: 'fake', processed: 999, uptimeSeconds: 10 } });
    expect(JSON.parse(query.mock.calls[0]![1][4])).toMatchObject({ pid: process.pid, status: 'idle', processed: 7, failed: 1, uptimeSeconds: 10 });
  });
});
