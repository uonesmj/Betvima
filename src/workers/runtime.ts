/**
 * WORKER RUNTIME (shared by all four workers).
 *
 *  * durable queue on `nova.job_queue`; claimed with `for update skip locked`
 *  * heartbeats into `nova.worker_heartbeats` (the admin UI shows liveness from this)
 *  * advisory worker locks so a scheduled sweep runs once across the whole fleet
 *  * graceful shutdown on SIGTERM/SIGINT: finishes the current job, then exits
 *  * exponential backoff with a dead-letter ceiling; every failure is logged with a code
 */
import { createServices, type Services } from '@/server/services/container';
import { createLogger, type Logger } from '@/server/logger';
import { serverEnv } from '@/server/env';
import type { Job, JobStatus } from '@/lib/types';

export interface WorkerContext {
  services: Services;
  log: Logger;
  workerId: string;
  queue: string;
  /** Run once with a distributed lock; returns false when another replica holds it. */
  withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | null>;
}

export interface JobHandler {
  /** Job kinds this handler accepts. */
  kinds: string[];
  handle(job: Job, ctx: WorkerContext): Promise<Record<string, unknown> | void>;
}

export interface WorkerOptions {
  queue: string;
  handlers: JobHandler[];
  /**
   * One-shot mode (`NOVA_WORKER_ONCE=true`): run the periodic tick once, drain the queue and
   * exit. Used by cron-style deployments, CI smoke tests and `scripts/workers-smoke.sh`.
   */
  /** Periodic protocol work (provider sync, sweeps) - guarded by a lock. */
  tick?: (ctx: WorkerContext) => Promise<void>;
  tickIntervalMs?: number;
  pollIntervalMs?: number;
  batchSize?: number;
}

export interface WorkerHandle {
  stop(): Promise<void>;
  stats(): { processed: number; failed: number; lastError: string | null; startedAt: string };
}

export function createWorker(options: WorkerOptions): WorkerHandle {
  const env = serverEnv();
  const log = createLogger({ component: 'worker', queue: options.queue });
  const workerId = env.WORKER_ID || `${options.queue}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const services = createServices();
  // A tick-only worker (such as live odds) must not lease jobs it cannot handle.
  // An empty kinds array means "all kinds" to the database queue adapter.
  const acceptedKinds = options.handlers.flatMap((handler) => handler.kinds);
  const startedAt = new Date().toISOString();
  const stats = { processed: 0, failed: 0, lastError: null as string | null };

  let stopping = false;
  let sleeping: Promise<void> | null = null;

  const ctx: WorkerContext = {
    services, log, workerId, queue: options.queue,
    async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | null> {
      const acquired = await services.jobs.acquireLock({ key, workerId, ttlSeconds });
      if (!acquired) return null;
      try {
        return await fn();
      } finally {
        await services.jobs.releaseLock({ key, workerId }).catch(() => undefined);
      }
    },
  };

  const sleep = (ms: number) => {
    sleeping = new Promise<void>((resolve) => setTimeout(resolve, ms));
    return sleeping;
  };

  const heartbeat = async (status: 'starting' | 'idle' | 'busy' | 'error', currentJobId: string | null = null) => {
    await services.jobs.heartbeat({
      workerId, queue: options.queue, status, processedCount: stats.processed, failedCount: stats.failed,
      currentJobId, metrics: { lastError: stats.lastError, uptimeSeconds: Math.round(process.uptime()) },
      staleAfterSeconds: env.WORKER_HEARTBEAT_SECONDS * 3,
    }).catch((error) => log.warn('heartbeat failed', { error: (error as Error).message }));
  };

  async function runJob(job: Job): Promise<void> {
    const handler = options.handlers.find((h) => h.kinds.includes(job.kind)) ?? options.handlers[0];
    if (!handler) {
      await services.jobs.complete({ jobId: job.id, workerId, status: 'failed', error: `NO_HANDLER:${job.kind}` });
      return;
    }

    // A processing job is leased for 300s by default. Renew at one-third of the
    // lease interval so long-running handlers cannot become claimable by another
    // worker while still executing.
    const leaseSeconds = 300;
    const renewalIntervalMs = Math.max(10_000, Math.floor((leaseSeconds * 1000) / 3));
    let renewalTimer: ReturnType<typeof setInterval> | null = null;
    let leaseLost = false;

    const renewLease = async () => {
      try {
        const renewed = await services.jobs.renewLease({
          jobId: job.id,
          workerId,
          leaseSeconds,
        });
        if (!renewed) {
          leaseLost = true;
          log.error('job lease lost', { jobId: job.id, kind: job.kind, workerId });
        }
      } catch (error) {
        log.warn('job lease renewal failed', {
          jobId: job.id,
          kind: job.kind,
          error: (error as Error).message,
        });
      }
    };

    try {
      renewalTimer = setInterval(() => { void renewLease(); }, renewalIntervalMs);

      const result = await handler.handle(job, ctx);

      if (leaseLost) {
        stats.failed += 1;
        stats.lastError = 'JOB_LEASE_LOST';
        log.error('job completion skipped after lease loss', {
          jobId: job.id,
          kind: job.kind,
          workerId,
        });
        return;
      }

      await services.jobs.complete({
        jobId: job.id,
        workerId,
        status: 'succeeded',
        result: result ?? null,
      });
      stats.processed += 1;
      log.info('job completed', { jobId: job.id, kind: job.kind, attempt: job.attempts + 1 });
    } catch (error) {
      stats.failed += 1;
      stats.lastError = (error as Error).message.slice(0, 500);
      const attempt = job.attempts + 1;
      const retryable = attempt < job.maxAttempts && !/^(INVALID|PERMANENT|NOT_FOUND)/.test(stats.lastError);
      const delayMs = Math.min(env.WORKER_BACKOFF_BASE_MS * 2 ** attempt, 15 * 60_000);

      if (!leaseLost) {
        await services.jobs.complete({
          jobId: job.id,
          workerId,
          status: 'failed',
          error: stats.lastError,
          retryInMs: retryable ? delayMs : null,
        }).catch(() => undefined);
      } else {
        log.error('job failure completion skipped after lease loss', {
          jobId: job.id,
          kind: job.kind,
          workerId,
        });
      }

      log.error('job failed', {
        jobId: job.id,
        kind: job.kind,
        attempt,
        retryable,
        error: stats.lastError,
      });
    } finally {
      if (renewalTimer) clearInterval(renewalTimer);
    }
  }

  async function loop(): Promise<void> {
    await heartbeat('starting');
    let lastTick = 0;
    while (!stopping) {
      try {
        const now = Date.now();
        if (options.tick && now - lastTick > (options.tickIntervalMs ?? 15_000)) {
          lastTick = now;
          await options.tick(ctx).catch((error) => log.error('tick failed', { error: (error as Error).message }));
          await heartbeat('idle');
        }
        const jobs = acceptedKinds.length === 0 ? [] : await services.jobs.claim({
          queue: options.queue, workerId, limit: options.batchSize ?? 5,
          kinds: acceptedKinds,
        });
        if (jobs.length === 0) {
          await sleep(options.pollIntervalMs ?? 2_000);
          continue;
        }
        for (const job of jobs) {
          if (stopping) {
            await services.jobs.complete({ jobId: job.id, workerId, status: 'failed', error: 'WORKER_STOPPING' }).catch(() => undefined);
            break;
          }
          await heartbeat('busy', job.id);
          await runJob(job);
        }
      } catch (error) {
        stats.lastError = (error as Error).message.slice(0, 500);
        log.error('loop error', { error: stats.lastError });
        await heartbeat('error');
        await sleep(5_000);
      }
    }
    await heartbeat('idle');
    log.info('worker stopped', { workerId, processed: stats.processed, failed: stats.failed });
  }

  /**
   * One-shot execution: one periodic tick, then drain whatever is claimable, then exit.
   * Exit code 1 when any job failed, so a cron wrapper can alert on it.
   */
  async function runOnce(): Promise<void> {
    await heartbeat('starting');
    log.info('one-shot run starting', { workerId });
    if (options.tick) {
      try {
        await options.tick(ctx);
      } catch (error) {
        stats.failed += 1;
        stats.lastError = (error as Error).message.slice(0, 500);
        log.error('tick failed', { error: stats.lastError });
      }
    }
    for (let round = 0; acceptedKinds.length > 0 && round < 20; round += 1) {
      const jobs = await services.jobs.claim({
        queue: options.queue, workerId, limit: options.batchSize ?? 5,
        kinds: acceptedKinds,
      });
      if (jobs.length === 0) break;
      for (const job of jobs) await runJob(job);
    }
    await heartbeat(stats.failed > 0 ? 'error' : 'idle');
    log.info('one-shot run finished', { workerId, processed: stats.processed, failed: stats.failed, lastError: stats.lastError });
    process.exitCode = stats.failed > 0 ? 1 : 0;
    // Give the logger and the pool a moment to flush before the process ends.
    setTimeout(() => process.exit(process.exitCode ?? 0), 250);
  }

  if (process.env.NOVA_WORKER_ONCE === 'true' || process.env.NOVA_WORKER_ONCE === '1') {
    void runOnce();
  } else {
    void loop();
  }

  const shutdown = async (signal: string) => {
    if (stopping) return;
    log.info('shutdown signal received', { signal });
    stopping = true;
    await Promise.race([sleeping ?? Promise.resolve(), sleep(2_000)]);
  };
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  return {
    stop: async () => { await shutdown('manual'); },
    stats: () => ({ ...stats, startedAt }),
  };
}

export const jobStatusLabel = (status: JobStatus): string => status;
