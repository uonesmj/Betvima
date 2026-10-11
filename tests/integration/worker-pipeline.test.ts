/**
 * WORKER PIPELINE, END TO END (real database, real worker process).
 *
 * A worker is started as a real child process in one-shot mode (`NOVA_WORKER_ONCE=true`),
 * so this test proves the shipped entry point boots, claims durable jobs from the queue,
 * settles a bet and records a heartbeat - not just that a function can be called.
 *
 * Skipped (never faked) when no database is configured.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PostgresBettingRepository } from '@/server/adapters/postgres/betting';
import { PostgresWalletRepository } from '@/server/adapters/postgres/wallet';
import { PostgresCatalogRepository } from '@/server/adapters/postgres/catalog';
import { createMatchWithMarket, createUser, integrationDb, key } from './helpers';
import type { PostgresDb } from '@/server/db/postgres';

const execFileAsync = promisify(execFile);
const db = integrationDb() as PostgresDb | null;
const suite = db ? describe : describe.skip;
const repoRoot = path.resolve(__dirname, '../..');

suite('settlement worker process', () => {
  const betting = new PostgresBettingRepository(db as PostgresDb);
  const wallet = new PostgresWalletRepository(db as PostgresDb);
  const catalog = new PostgresCatalogRepository(db as PostgresDb);
  const actor = { userId: null, role: 'service_role' as const, correlationId: 'worker-pipeline' };

  afterAll(async () => {
    if (db) await db.close();
  });

  it('settles a queued bet through the real worker entry point', async () => {
    const { userId } = await createUser(db as PostgresDb, { balanceMinor: 1_000_000n });
    const { matchId, marketId, selectionId } = await createMatchWithMarket(db as PostgresDb, { odds: 25_000n });

    const placed = await betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey: key('wp-place'),
      payload: {
        type: 'SINGLE', stakeMinor: '100000', currency: 'IRT',
        legs: [{ selectionId, marketId, matchId, clientOddsScaled: '25000', marketVersion: 1, acceptOddsChange: false }],
      },
    });
    expect(placed.status).toBe('accepted');

    // Authoritative result: home wins, so the HOME selection grades WON (2.50 -> 250,000 payout).
    await db!.query(
      `insert into nova.match_results (match_id, revision, status, home_score, away_score, provider, authoritative, observed_at)
       values ($1, 1, 'finished', 2, 0, 'integration', true, now())`,
      [matchId],
    );
    await db!.query(
      `insert into nova.settlement_jobs (bet_id, match_id, user_id, status, reason)
       values ($1, $2, $3, 'queued', 'integration test')`,
      [placed.bet.id, matchId, userId],
    );

    const env = {
      ...process.env,
      SUPABASE_DB_URL: process.env.INTEGRATION_DATABASE_URL!,
      NOVA_WORKER_ONCE: 'true',
      WORKER_ID: `test-settlement-${Date.now()}`,
      SPORTS_PROVIDER: 'disabled',
      PAYMENT_PROVIDER: 'disabled',
      LOG_LEVEL: 'info',
    };
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', path.join(repoRoot, 'src/workers/entrypoints/settlement.worker.ts')],
      { cwd: repoRoot, env, timeout: 120_000 },
    );
    expect(stdout).toContain('one-shot run finished');

    const bet = await db!.queryOne<{ status: string; payout_minor: string | null; settled_at: string | null }>(
      `select status, payout_minor, settled_at from nova.bets where id = $1`, [placed.bet.id],
    );
    expect(bet?.status).toBe('settled');
    expect(BigInt(bet?.payout_minor ?? '0')).toBe(250_000n);
    expect(bet?.settled_at).not.toBeNull();

    // The stake was taken at placement and the winnings credited at settlement: 1,000,000 - 100,000 + 250,000.
    const after = await wallet.getWallet(actor, userId, 'IRT');
    expect(after?.balanceMinor).toBe(1_150_000n);

    // Ledger and balance must agree (the invariant the health check probes).
    const ledger = await db!.queryOne<{ sum: string }>(
      `select coalesce(sum(t.amount_minor),0) as sum from nova.wallet_transactions t
         join nova.wallets w on w.id = t.wallet_id where w.user_id = $1 and t.status = 'posted'`,
      [userId],
    );
    expect(BigInt(ledger?.sum ?? '0')).toBe(after?.balanceMinor ?? -1n);

    // One settlement row per (bet, revision): the worker cannot settle twice.
    const settlements = await db!.queryOne<{ total: string }>(
      `select count(*) as total from nova.bet_settlements where bet_id = $1`, [placed.bet.id],
    );
    expect(Number(settlements?.total)).toBe(1);

    // Heartbeat recorded, so the admin "Workers" page shows real liveness for this process.
    const heartbeat = await db!.queryOne<{ total: string }>(
      `select count(*) as total from nova.worker_heartbeats where worker like 'settlement' and worker_id like 'test-settlement-%'`,
    );
    expect(Number(heartbeat?.total)).toBeGreaterThan(0);

    // The domain queue entry is closed out, not left stuck in 'processing'.
    // `settlement_job_status` = queued | processing | done | failed | manual_review | skipped.
    const job = await db!.queryOne<{ status: string; attempts: number; processed_at: string | null }>(
      `select status, attempts, processed_at from nova.settlement_jobs where bet_id = $1 order by created_at desc limit 1`,
      [placed.bet.id],
    );
    expect(job?.status).toBe('done');
    expect(job?.processed_at).not.toBeNull();
  }, 180_000);

  it('claims only the job kinds the worker handles (migration 0140)', async () => {
    const { userId } = await createUser(db as PostgresDb, { balanceMinor: 100_000n });
    const { matchId, marketId, selectionId } = await createMatchWithMarket(db as PostgresDb, { odds: 20_000n });
    const placed = await betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey: key('wp-kind'),
      payload: {
        type: 'SINGLE', stakeMinor: '10000', currency: 'IRT',
        legs: [{ selectionId, marketId, matchId, clientOddsScaled: '20000', marketVersion: 1, acceptOddsChange: false }],
      },
    });

    const handledKey = key('wp-handled');
    const decoyKey = key('wp-decoy');
    await db!.query(
      `insert into nova.job_queue (queue, job_key, payload, status, idempotency_key)
       values ('settlement', 'settlement.settle_bet', jsonb_build_object('betId', $1::text), 'queued', $2),
              ('settlement', 'settlement.unknown_kind', jsonb_build_object('betId', $1::text), 'queued', $3)`,
      [placed.bet.id, handledKey, decoyKey],
    );

    const env = {
      ...process.env,
      SUPABASE_DB_URL: process.env.INTEGRATION_DATABASE_URL!,
      NOVA_WORKER_ONCE: 'true',
      WORKER_ID: `test-settlement-kinds-${Date.now()}`,
      SPORTS_PROVIDER: 'disabled',
      PAYMENT_PROVIDER: 'disabled',
    };
    await execFileAsync(
      process.execPath,
      ['--import', 'tsx', path.join(repoRoot, 'src/workers/entrypoints/settlement.worker.ts')],
      { cwd: repoRoot, env, timeout: 120_000 },
    );

    const handled = await db!.queryOne<{ status: string }>(
      `select status from nova.job_queue where idempotency_key = $1`, [handledKey],
    );
    const decoy = await db!.queryOne<{ status: string }>(
      `select status from nova.job_queue where idempotency_key = $1`, [decoyKey],
    );

    // The bet is still open (no result recorded), so the handler runs and reports the skip:
    // what matters is that the job was CLAIMED and closed by the worker.
    expect(handled?.status).toBe('succeeded');
    // A job of an unknown kind is never locked by this worker, so it stays available.
    expect(decoy?.status).toBe('queued');
  }, 180_000);
});
