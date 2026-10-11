import type { Db } from '@/lib/ports/db';
import type { JobRepository } from '@/lib/ports/repositories';
import type { Job, UUID } from '@/lib/types';
import { pgArray, toIso } from '@/server/db/rows';

/**
 * Durable queue backed by `nova.job_queue`.
 * Claiming uses `for update skip locked`, so any number of workers can run in parallel
 * without ever processing the same job twice.
 */
export class PostgresJobRepository implements JobRepository {
  constructor(readonly db: Db) {}

  async enqueue(input: { queue: string; kind: string; payload: Record<string, unknown>; priority?: number; runAfter?: string | null; idempotencyKey?: string | null; maxAttempts?: number }) {
    const result = await this.db.rpc<Record<string, unknown>>('enqueue_job', {
      p_queue: input.queue, p_job_key: input.kind, p_payload: input.payload,
      p_idempotency_key: input.idempotencyKey ?? null, p_run_at: input.runAfter ?? null,
      p_max_attempts: input.maxAttempts ?? 5,
    });
    return { id: String(result.id), enqueued: !result.duplicate };
  }

  async claim(input: { queue: string; workerId: string; limit: number; kinds?: string[] }): Promise<Job[]> {
    // The kind filter is applied inside `nova.claim_jobs` (migration 0140): a worker must never
    // lock a job it cannot handle, otherwise the row stays locked until the TTL expires.
    const kinds = input.kinds && input.kinds.length > 0 ? pgArray(input.kinds) : null;
    const rows = await this.db.query<Record<string, unknown>>(
      `select * from nova.claim_jobs($1,$2,$3,$4,$5::text[])`, [input.queue, input.workerId, input.limit, 300, kinds],
    );
    return rows
      .map((r) => ({
        id: String(r.id), queue: String(r.queue), kind: String(r.job_key),
        payload: (r.payload ?? {}) as Record<string, unknown>, status: String(r.status) as Job['status'],
        priority: 0, attempts: Number(r.attempts), maxAttempts: Number(r.max_attempts ?? 5),
        lockedBy: (r.locked_by ?? null) as string | null, lockedAt: r.locked_at ? toIso(r.locked_at) : null,
        availableAt: toIso(r.run_after), startedAt: r.locked_at ? toIso(r.locked_at) : null,
        finishedAt: r.finished_at ? toIso(r.finished_at) : null, lastError: (r.last_error ?? null) as string | null,
        idempotencyKey: (r.idempotency_key ?? null) as string | null,
        runAfter: r.run_after ? toIso(r.run_after) : null, createdAt: toIso(r.created_at),
        updatedAt: toIso(r.finished_at ?? r.created_at),
      }));
  }

  async complete(input: { jobId: UUID; workerId: string; status: 'succeeded' | 'failed'; error?: string | null; result?: Record<string, unknown> | null; retryInMs?: number | null }): Promise<Job | null> {
    await this.db.rpc('complete_job', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_status: input.status,
      p_error: input.error ?? null,
      p_retry_in_ms: input.retryInMs ?? null,
    });
    const row = await this.db.queryOne<Record<string, unknown>>(`select * from nova.job_queue where id = $1`, [input.jobId]);
    if (!row) return null;
    return {
      id: String(row.id), queue: String(row.queue), kind: String(row.job_key),
      payload: (row.payload ?? {}) as Record<string, unknown>, status: String(row.status) as Job['status'],
      priority: 0, attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts ?? 5),
      lockedBy: (row.locked_by ?? null) as string | null, lockedAt: row.locked_at ? toIso(row.locked_at) : null,
      availableAt: toIso(row.run_after), startedAt: null, finishedAt: row.finished_at ? toIso(row.finished_at) : null,
      lastError: (row.last_error ?? null) as string | null, idempotencyKey: (row.idempotency_key ?? null) as string | null,
      runAfter: row.run_after ? toIso(row.run_after) : null, createdAt: toIso(row.created_at),
      updatedAt: toIso(row.finished_at ?? row.created_at),
    };
  }

  async renewLease(input: { jobId: UUID; workerId: string; leaseSeconds?: number }): Promise<boolean> {
    const result = await this.db.rpc<boolean>('renew_job_lease', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_lease_seconds: input.leaseSeconds ?? 300,
    });
    return Boolean(result);
  }

  async heartbeat(input: { workerId: string; queue: string; status: string; processedCount: number; failedCount: number; currentJobId?: UUID | null; metrics?: Record<string, unknown> | null; staleAfterSeconds: number }) {
    await this.db.query(
      `insert into nova.worker_heartbeats (worker_id, worker, hostname, version, last_seen_at, metadata)
       values ($1, $2, $3, $4, now(), $5::jsonb)
       on conflict (worker_id) do update set last_seen_at = now(), metadata = excluded.metadata, worker = excluded.worker`,
      [input.workerId, input.queue, process.env.HOSTNAME ?? 'unknown', process.env.npm_package_version ?? '1.0.0',
        JSON.stringify({ status: input.status, processed: input.processedCount, failed: input.failedCount, current_job: input.currentJobId ?? null, ...(input.metrics ?? {}) })],
    );
  }

  async acquireLock(input: { key: string; workerId: string; ttlSeconds: number }): Promise<boolean> {
    const result = await this.db.rpc<boolean>('acquire_worker_lock', {
      p_key: input.key, p_worker_id: input.workerId, p_ttl_seconds: input.ttlSeconds,
    });
    return Boolean(result);
  }

  async releaseLock(input: { key: string; workerId: string }): Promise<void> {
    await this.db.rpc('release_worker_lock', { p_key: input.key, p_worker_id: input.workerId });
  }
}
