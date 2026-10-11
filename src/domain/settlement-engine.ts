/**
 * NOVA - SETTLEMENT ENGINE (orchestration)
 *
 *   MATCH FINISHED -> AUTHORITATIVE RESULT -> RESULT VALIDATION -> SETTLEMENT QUEUE
 *   -> GRADE BET LEGS -> CALCULATE BET RESULT -> ATOMIC WALLET CREDIT/REFUND
 *   -> BET STATUS UPDATE -> LEDGER -> AUDIT -> NOTIFICATION
 *
 * Guarantees:
 *   - Never double settle: the queue row is claimed with a lock, the bet is only settleable
 *     from a non-terminal state, and nova.settle_bet re-checks + is idempotent by
 *     (bet_id, result_revision).
 *   - Re-grade creates a reversal + a new settlement; historical rows are never overwritten.
 *   - A result that cannot be mapped to a decision goes to MANUAL_REVIEW, never to a guess.
 */
import { gradingPipeline } from './settlement-grading';
import { computeBetPayout } from './bet-settlement-math';
import { DomainError } from './errors';
import type { DomainAdapters } from './ports';
import type { Bet, MatchResult, NotificationType, SettlementJob } from './types';

export interface SettlementEngineDeps {
  adapters: DomainAdapters;
  workerId: string;
  /** Max bets handled per job batch. */
  batchSize: number;
}

export interface SettleMatchReport {
  matchId: string;
  resultStatus: string;
  betsEnqueued: number;
  betsSettled: number;
  betsManualReview: number;
  totalCreditedMinor: bigint;
  errors: string[];
}

export class SettlementEngine {
  constructor(private readonly deps: SettlementEngineDeps) {}

  private get a(): DomainAdapters {
    return this.deps.adapters;
  }

  /** Step 1-3: validate the authoritative result and enqueue settlement work. */
  async settleMatch(matchId: string): Promise<SettleMatchReport> {
    const log = this.a.logger.child({ op: 'settleMatch', matchId });
    const report: SettleMatchReport = {
      matchId, resultStatus: 'unknown', betsEnqueued: 0, betsSettled: 0, betsManualReview: 0,
      totalCreditedMinor: 0n, errors: [],
    };

    if (await this.a.system.isMaintenanceMode()) throw new DomainError('MAINTENANCE_MODE');
    if (!(await this.a.system.getOperationState('SETTLEMENT'))) throw new DomainError('SETTLEMENT_DISABLED');

    const result = await this.a.settlement.getMatchResult(matchId);
    if (!result) {
      log.warn('no authoritative result available; nothing to settle');
      return report;
    }
    report.resultStatus = result.status;
    if (!result.authoritative) {
      log.warn('result is not authoritative - enqueuing for manual review instead of settling');
      report.betsManualReview += await this.a.settlement.enqueueForMatch(matchId, 'RESULT_NOT_AUTHORITATIVE');
      return report;
    }
    const enqueued = await this.a.settlement.enqueueForMatch(matchId, `MATCH_${result.status.toUpperCase()}_REV_${result.revision}`);
    report.betsEnqueued = enqueued;
    log.info('settlement jobs enqueued', { enqueued, revision: result.revision });
    return report;
  }

  /** Steps 4-8: process queued jobs (claims with a lock; safe to run concurrently). */
  async processQueue(limit = this.deps.batchSize): Promise<{ processed: number; failed: number; manualReview: number; creditedMinor: bigint }> {
    const log = this.a.logger.child({ op: 'processSettlementQueue', workerId: this.deps.workerId });
    const out = { processed: 0, failed: 0, manualReview: 0, creditedMinor: 0n };
    if (!(await this.a.system.getOperationState('SETTLEMENT'))) {
      log.warn('settlement disabled by emergency control - skipping batch');
      return out;
    }
    const jobs = await this.a.settlement.claimJobs(this.deps.workerId, limit);
    for (const job of jobs) {
      try {
        const outcome = await this.settleBet(job);
        if (outcome === 'manual_review') {
          out.manualReview += 1;
          await this.a.settlement.completeJob(job.id, this.deps.workerId, 'manual_review', 'LEGS_REQUIRE_REVIEW');
        } else {
          out.processed += 1;
          await this.a.settlement.completeJob(job.id, this.deps.workerId, 'done');
        }
      } catch (error) {
        out.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        log.error('settlement job failed', { jobId: job.id, betId: job.betId, error: message });
        await this.a.settlement.completeJob(job.id, this.deps.workerId, job.attempts >= 5 ? 'manual_review' : 'failed', message);
      }
    }
    return out;
  }

  /** Steps 4-8 for one bet. Returns 'settled' | 'manual_review' | 'skipped'. */
  async settleBet(job: SettlementJob): Promise<'settled' | 'manual_review' | 'skipped'> {
    const log = this.a.logger.child({ op: 'settleBet', betId: job.betId, jobId: job.id });
    const bet = await this.a.betting.getBet(job.betId);
    if (!bet) {
      log.warn('bet not found for settlement job');
      return 'skipped';
    }
    if (bet.status === 'settled' || bet.status === 'void' || bet.status === 'refunded' || bet.status === 'cancelled') {
      // Idempotency guard #1 (job-level). #2 lives inside nova.settle_bet.
      log.info('bet already in a terminal state - skipping', { status: bet.status });
      return 'skipped';
    }

    const grading = await gradingPipeline({
      adapters: this.a,
      bet,
      workerId: this.deps.workerId,
    });
    if (grading.kind === 'manual_review') {
      log.warn('bet requires manual review', { reason: grading.reason, legs: grading.legs });
      return 'manual_review';
    }

    const payout = computeBetPayout({
      stake: bet.stake,
      legs: grading.legs.map((l) => ({ selectionId: l.selectionId, grade: l.grade, odds: l.odds })),
    });
    if (payout.requiresManualReview) {
      log.warn('payout requires manual review', { reason: payout.manualReviewReason });
      return 'manual_review';
    }

    const outcome = await this.a.settlement.settleBetAtomic({
      betId: bet.id,
      gradedLegs: grading.legs.map((l) => ({ selectionId: l.selectionId, grade: l.grade, reason: l.reason, authoritative: l.authoritative })),
      payoutMinor: payout.payout.amount,
      currency: bet.stake.currency,
      correlationId: `${this.deps.workerId}:${job.id}`,
      workerId: this.deps.workerId,
      resultRevision: grading.resultRevision,
    });

    if (outcome.idempotentReplay) {
      log.info('settlement already applied (idempotent replay)');
      return 'skipped';
    }

    await this.notifySettlement(bet, outcome.status, payout.payout.amount, log);
    log.info('bet settled', {
      status: outcome.status, payout: payout.payout.amount.toString(),
      netUserResult: payout.netUserResult.amount.toString(), ledgerTransactionId: outcome.ledgerTransactionId,
    });
    return 'settled';
  }

  /**
   * Re-grade: an authoritative result changed after settlement.
   * NEVER mutates history: the previous settlement is reversed (ledger reversal entry +
   * affiliate reversal entries), then the bet is re-graded and re-settled with a new revision.
   */
  async regrade(input: {
    betId: string; reason: string; actorId: string; correlationId: string;
  }): Promise<{ reversed: boolean; resettled: boolean; message: string }> {
    const log = this.a.logger.child({ op: 'regrade', betId: input.betId, correlationId: input.correlationId });
    const bet = await this.a.betting.getBet(input.betId);
    if (!bet) throw new DomainError('NOT_FOUND', 'Bet not found');

    const reversal = await this.a.settlement.reverseBetSettlement({
      betId: input.betId, reason: input.reason, actorId: input.actorId, correlationId: input.correlationId,
    });
    await this.a.audit.record({
      actorId: input.actorId, actorRole: null, action: 'bet.regrade.reversal',
      targetType: 'bet', targetId: input.betId, before: { status: bet.status }, after: { status: 'pending' },
      reason: input.reason, correlationId: input.correlationId, ip: null, userAgent: null,
    });
    if (!reversal.reversed) {
      log.warn('no prior settlement to reverse');
      return { reversed: false, resettled: false, message: 'No prior settlement existed' };
    }

    await this.a.settlement.enqueueForMatch(bet.legs[0]?.matchId ?? '', `REGRADE:${input.reason}`);
    log.info('settlement reversed; re-grading queued');
    return { reversed: true, resettled: true, message: 'Reversal applied and re-grade queued' };
  }

  /** Crash recovery: bets fully graded but never marked settled. */
  async recoverStuck(): Promise<number> {
    const stuck = await this.a.settlement.findStuckBets(50);
    let recovered = 0;
    for (const bet of stuck) {
      try {
        const res = await this.settleBet({
          id: `recovery:${bet.id}`, betId: bet.id, userId: bet.userId, status: 'queued',
          attempts: 0, reason: 'CRASH_RECOVERY', createdAt: new Date().toISOString(), processedAt: null,
        });
        if (res !== 'skipped') recovered += 1;
      } catch (error) {
        this.a.logger.error('crash recovery failed for bet', { betId: bet.id, error: String(error) });
      }
    }
    return recovered;
  }

  private async notifySettlement(bet: Bet, status: string, payoutMinor: bigint, log: ReturnType<DomainAdapters['logger']['child']>): Promise<void> {
    const map: Record<string, NotificationType> = {
      settled: payoutMinor > 0n ? 'bet_won' : 'bet_lost',
      void: 'bet_void',
      partially_settled: payoutMinor > 0n ? 'bet_won' : 'bet_lost',
      refunded: 'bet_void',
    };
    const type = map[status];
    if (!type) return;
    try {
      await this.a.notifications.create({
        userId: bet.userId,
        type,
        title: type === 'bet_won' ? 'Bet won' : type === 'bet_lost' ? 'Bet settled' : 'Bet void',
        body: `Bet ${bet.publicId} has been settled`,
        linkPath: `/bets/${bet.publicId}`,
        data: { betId: bet.id, status, payout: payoutMinor.toString() },
      });
    } catch (error) {
      log.warn('settlement notification failed (money already committed)', { error: String(error) });
    }
  }
}

export type { MatchResult };
