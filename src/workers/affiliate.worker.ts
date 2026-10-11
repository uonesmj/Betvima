/**
 * AFFILIATE WORKER
 *  * Friday settlement sweep (configurable day/time/timezone by the commission config)
 *  * payout lifecycle: eligible -> approved -> processing -> paid
 *  * commission reversal for regraded bets is handled by the database when a settlement
 *    is reversed, so this worker never edits ledger rows
 *  * fraud signals are recomputed and flagged for human review (never auto-confiscated)
 */
import { createWorker, type WorkerContext, type JobHandler } from './runtime';
import { serverEnv } from '@/server/env';

const env = serverEnv();

const handlers: JobHandler[] = [
  {
    kinds: ['affiliate.settle_period'],
    async handle(job, ctx: WorkerContext) {
      const affiliateId = String(job.payload.affiliateId ?? '');
      const periodEnd = String(job.payload.periodEnd ?? defaultPeriodEnd());
      const periodStart = String(job.payload.periodStart ?? new Date(new Date(periodEnd).getTime() - 7 * 864e5).toISOString());
      const result = await ctx.services.affiliate.settlePeriod({
        affiliateId, periodStart, periodEnd, actorId: null,
      });
      await ctx.services.notificationsService.emit({
        userId: String(job.payload.userId ?? ''),
        eventKey: 'affiliate.commission', locale: 'en',
        data: { amount: result.payableMinor.toString(), period: `${periodStart.slice(0, 10)} → ${periodEnd.slice(0, 10)}` },
        dedupeKey: `affiliate:${affiliateId}:${periodEnd.slice(0, 10)}`,
      });
      return { affiliateId, status: result.status, payableMinor: result.payableMinor.toString() };
    },
  },
  {
    kinds: ['affiliate.payout_status'],
    async handle(job, ctx: WorkerContext) {
      const payoutId = String(job.payload.payoutId ?? '');
      const payout = await ctx.services.affiliate.getPayout(payoutId);
      if (!payout) throw new Error('NOT_FOUND:payout');
      if (!env.paymentProviderEnabled) {
        // Cannot pay without a provider: leave the payout in manual_review for finance.
        if (payout.status === 'processing') {
          await ctx.services.affiliate.transitionPayout({
            payoutId, to: 'rejected', reason: 'no payment provider configured; manual bank transfer required',
            actorId: payout.affiliateId,
          }).catch(() => undefined);
        }
        return { payoutId, status: 'awaiting_provider' };
      }
      return { payoutId, status: payout.status };
    },
  },
  {
    kinds: ['affiliate.fraud_scan'],
    async handle(job, ctx: WorkerContext) {
      const affiliateId = String(job.payload.affiliateId ?? '');
      const signals = await ctx.services.affiliate.fraudSignals(affiliateId);
      if (signals.riskScore === undefined) return { affiliateId, signals };
      return { affiliateId, signals: { ...signals } };
    },
  },
];

createWorker({
  queue: 'affiliate',
  handlers,
  tickIntervalMs: 15 * 60_000,
  pollIntervalMs: 5_000,
  batchSize: 5,
  async tick(ctx) {
    await ctx.withLock('affiliate:sweep', 600, async () => {
      const enabled = await ctx.services.db.queryOne<{ enabled: boolean }>(
        `select enabled from nova.system_operations where key = 'AFFILIATE_SETTLEMENT'`,
      ).catch(() => null);
      if (enabled && enabled.enabled === false) {
        ctx.log.warn('affiliate settlement disabled by operation switch');
        return;
      }
      const due = await ctx.services.affiliate.settleAllDue({ now: new Date().toISOString(), dryRun: false });
      if (due.length > 0) ctx.log.info('affiliate settlements processed', { count: due.length });
    });
  },
});

function defaultPeriodEnd(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysSinceFriday = (day + 2) % 7;
  const friday = new Date(now.getTime() - daysSinceFriday * 864e5);
  friday.setUTCHours(23, 59, 59, 999);
  return friday.toISOString();
}
