import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jobs = vi.hoisted(() => ({
  heartbeat: vi.fn().mockResolvedValue(undefined),
  claim: vi.fn().mockResolvedValue([]),
  complete: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/server/services/container', () => ({ createServices: () => ({ jobs }) }));
vi.mock('@/server/env', () => ({ serverEnv: () => ({ WORKER_HEARTBEAT_SECONDS: 10 }) }));
vi.mock('@/server/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
import { createWorker } from '@/workers/runtime';

describe('worker runtime: tick-only queue isolation', () => {
  let termListeners: NodeJS.SignalsListener[];
  let intListeners: NodeJS.SignalsListener[];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    termListeners = process.listeners('SIGTERM');
    intListeners = process.listeners('SIGINT');
    vi.stubEnv('NOVA_WORKER_ONCE', 'false');
  });
  afterEach(() => {
    for (const listener of process.listeners('SIGTERM')) if (!termListeners.includes(listener)) process.removeListener('SIGTERM', listener);
    for (const listener of process.listeners('SIGINT')) if (!intListeners.includes(listener)) process.removeListener('SIGINT', listener);
    vi.useRealTimers();
    vi.unstubAllEnvs();
    process.exitCode = 0;
  });

  it('runs periodic ticks without claiming or failing queued jobs', async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const worker = createWorker({ queue: 'odds-live', handlers: [], tick, tickIntervalMs: 10, pollIntervalMs: 5 });
    await vi.advanceTimersByTimeAsync(25);
    expect(tick).toHaveBeenCalled();
    expect(jobs.heartbeat).toHaveBeenCalled();
    expect(jobs.claim).not.toHaveBeenCalled();
    expect(jobs.complete).not.toHaveBeenCalled();
    const stopping = worker.stop();
    await vi.advanceTimersByTimeAsync(2000);
    await stopping;
  });

  it('does not drain a queue in tick-only one-shot mode', async () => {
    vi.stubEnv('NOVA_WORKER_ONCE', 'true');
    const tick = vi.fn().mockResolvedValue(undefined);
    createWorker({ queue: 'odds-live', handlers: [], tick });
    // Flush microtasks without running the one-shot process exit timer.
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledOnce();
    expect(jobs.claim).not.toHaveBeenCalled();
    expect(jobs.complete).not.toHaveBeenCalled();
  });

  it('keeps the accepted-kind filter for workers with handlers', async () => {
    const worker = createWorker({ queue: 'odds', handlers: [{ kinds: ['odds.sync'], handle: vi.fn() }], pollIntervalMs: 10 });
    await vi.advanceTimersByTimeAsync(0);
    expect(jobs.claim).toHaveBeenCalledWith(expect.objectContaining({ queue: 'odds', kinds: ['odds.sync'] }));
    const stopping = worker.stop();
    await vi.advanceTimersByTimeAsync(2000);
    await stopping;
  });
});
