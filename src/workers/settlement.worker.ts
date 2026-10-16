/**
 * SETTLEMENT WORKER
 * Turns finished matches into settled bets exactly once:
 *  * scans `nova.settlement_jobs` (queued by the odds worker / admin actions)
 *  * falls back to a periodic sweep of matches whose status is final
 *  * grades every leg from the newest authoritative result revision
 *  * never settles twice: the service refuses bets that are already final and the
 *    database enforces one settlement per (bet, revision)
 */
import { createWorker, type WorkerContext, type JobHandler } from './runtime';
import { serverEnv } from '@/server/env';
import { serviceRoleContext } from '@/server/context';

/** Workers act as the service role: no human id, and every action is audited DB-side. */
const serviceRoleActorId = null as unknown as string;

const env = serverEnv();

const handlers: JobHandler[] = [
  {
    kinds: ['settlement.settle_bet'],
    async handle(job, ctx: WorkerContext) {
      const betId = String(job.payload.betId ?? '');
      if (!betId) throw new Error('INVALID:betId missing');
      return settle(ctx, betId);
    },
  },
  {
    kinds: ['settlement.regrade'],
    async handle(job, ctx: WorkerContext) {
      const betId = String(job.payload.betId ?? '');
      const reason = String(job.payload.reason ?? 'result correction');
      if (!betId) throw new Error('INVALID:betId missing');
      const result = await ctx.services.settlement.regrade({
        betId, reason, actorId: serviceRoleActorId, idempotencyKey: `regrade:${betId}:${job.id}`,
      });
      return { betId, regraded: true, result };
    },
  },
];

createWorker({
  queue: 'settlement',
  handlers,
  tickIntervalMs: env.SETTLEMENT_SCAN_INTERVAL_SECONDS * 1000,
  pollIntervalMs: 2_000,
  batchSize: 10,
  async tick(ctx) {
    await ctx.withLock('settlement:sweep', 90, async () => {
      const enabled = await ctx.services.db.queryOne<{ enabled: boolean }>(
        `select enabled from nova.system_operations where key = 'SETTLEMENT'`,
      ).catch(() => null);
      if (enabled && enabled.enabled === false) {
        ctx.log.warn('settlement disabled by kill switch; sweep skipped');
        return;
      }
      // Queue settlement jobs for final matches that still have open bets.
      const queued = await ctx.services.db.query<{ count: string }>(
        `with candidates as (
           select b.id as bet_id, l.match_id, b.user_id
             from nova.bets b
             join nova.bet_legs l on l.bet_id = b.id
             join nova.matches m on m.id = l.match_id
            where b.status in ('accepted', 'partially_settled')
              and m.status::text in ('finished', 'cancelled', 'abandoned')
              and not exists (
                select 1 from nova.settlement_jobs j
                 where j.bet_id = b.id and j.match_id = l.match_id and j.status in ('queued', 'processing')
              )
            limit 200
         ), inserted as (
           insert into nova.settlement_jobs (bet_id, match_id, user_id, status, reason)
           select bet_id, match_id, user_id, 'queued', 'final match sweep' from candidates
           returning 1
         ) select count(*)::text as count from inserted`,
      ).catch(() => []);
      const count = Number(queued[0]?.count ?? 0);
      if (count > 0) ctx.log.info('settlement candidates queued', { count });

      // Claim settlement jobs atomically through the hardened DB ownership function.
      const jobs = await ctx.services.db.rpcRows<{ id: string; bet_id: string }>(
        'claim_settlement_jobs',
        {
          p_worker_id: ctx.workerId,
          p_limit: 25,
          p_lock_ttl_seconds: 300,
        },
      );

      for (const job of jobs ?? []) {
        const leaseSeconds = 300;
        const renewalIntervalMs = Math.max(
          10_000,
          Math.floor((leaseSeconds * 1000) / 3),
        );

        let renewalTimer: ReturnType<typeof setInterval> | null = null;
        let leaseLost = false;

        const renewLease = async () => {
          try {
            const renewed = await ctx.services.db.rpc<boolean>(
              'renew_settlement_job_lease',
              {
                p_job_id: job.id,
                p_worker_id: ctx.workerId,
                p_lease_seconds: leaseSeconds,
              },
            );

            if (!renewed) {
              leaseLost = true;
              ctx.log.error('settlement job lease lost', {
                jobId: job.id,
                betId: job.bet_id,
                workerId: ctx.workerId,
              });
            }
          } catch (error) {
            ctx.log.warn('settlement job lease renewal failed', {
              jobId: job.id,
              betId: job.bet_id,
              workerId: ctx.workerId,
              error: (error as Error).message,
            });
          }
        };

        try {
          renewalTimer = setInterval(() => {
            void renewLease();
          }, renewalIntervalMs);

          const result = await settle(ctx, job.bet_id);

          if (leaseLost) {
            ctx.log.error('settlement completion skipped after lease loss', {
              jobId: job.id,
              betId: job.bet_id,
              workerId: ctx.workerId,
            });
            continue;
          }

          const status =
            result.status === 'manual_review'
              ? 'manual_review'
              : result.status === 'skipped'
                ? 'skipped'
                : 'done';

          await ctx.services.db.rpc('complete_settlement_job', {
            p_job_id: job.id,
            p_worker_id: ctx.workerId,
            p_status: status,
            p_error: null,
          });

          ctx.log.info('settlement job processed', {
            jobId: job.id,
            betId: job.bet_id,
            status,
            result,
          });
        } catch (error) {
          const message = (error as Error).message.slice(0, 400);

          if (!leaseLost) {
            const status = 'failed';

            await ctx.services.db
              .rpc('complete_settlement_job', {
                p_job_id: job.id,
                p_worker_id: ctx.workerId,
                p_status: status,
                p_error: message,
              })
              .catch((updateError: Error) => {
                ctx.log.error('settlement job failure completion failed', {
                  jobId: job.id,
                  betId: job.bet_id,
                  error: updateError.message,
                });
              });
          } else {
            ctx.log.error('settlement failure completion skipped after lease loss', {
              jobId: job.id,
              betId: job.bet_id,
              workerId: ctx.workerId,
            });
          }

          ctx.log.error('settlement failed', {
            jobId: job.id,
            betId: job.bet_id,
            error: message,
          });
        } finally {
          if (renewalTimer) clearInterval(renewalTimer);
        }
      }
    });
  },
});

const FINAL_STATUSES = ['settled', 'void', 'cancelled', 'cashed_out', 'reversed'];

async function settle(ctx: WorkerContext, betId: string) {
  const bet = await ctx.services.betting.getBet(serviceRoleContext, betId, null);
  if (!bet) return { betId, status: 'skipped', reason: 'not_found' };
  if (FINAL_STATUSES.includes(bet.status)) return { betId, status: 'skipped', reason: 'already_final' };
  const plan = await ctx.services.settlement.plan(bet);
  if (plan.manualReviewReason) {
    ctx.log.warn('settlement requires manual review', { betId, reason: plan.manualReviewReason });
    return { betId, status: 'manual_review', reason: plan.manualReviewReason };
  }
  const { result } = await ctx.services.settlement.settle({
    betId, actorId: null, source: 'provider', idempotencyKey: `settle:${betId}:${bet.revision + 1}`,
  });
  if (!result) return { betId, status: 'skipped', reason: 'already_final' };

  // Inform the owner ONLY after the atomic settlement has succeeded.
  // Never alter, repeat or roll back a financial settlement for a notification.
  const notificationType =
    result.status === 'void' ? 'bet.void' :
    result.status === 'partially_settled' ? 'bet.partial' :
    result.payoutMinor > bet.stakeMinor ? 'bet.won' :
    result.payoutMinor === bet.stakeMinor ? 'bet.void' : 'bet.lost';
  try {
    const { NotificationService } = await import('@/server/services/notification-service');
    await new NotificationService(ctx.services).emit({
      userId: bet.userId,
      eventKey: notificationType,
      data: { betId, status: result.status,
        currency: bet.currency,
        settledPayoutMinor: result.payoutMinor.toString() },
      dedupeKey: 'bet:final:' + betId + ':' + String(bet.revision + 1),
    });
  } catch (error) {
    ctx.log.warn('post-settlement notification failed (money already committed)', {
      betId, error: error instanceof Error ? error.message : 'unknown',
    });
  }
  return { betId, status: result.status, payoutMinor: result.payoutMinor.toString() };
}
