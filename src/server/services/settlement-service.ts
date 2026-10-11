/**
 * SETTLEMENT SERVICE - the single decision path for settling a bet.
 *
 *   authoritative result  ->  leg grading (domain market rules)  ->  payout math
 *   (domain `computeBetPayout`)  ->  nova.settle_bet (money, idempotent)  ->  affiliate commission
 *
 * The API, the settlement worker and the admin "settle/regrade" actions all call this,
 * so there is exactly one place where "what does this bet pay?" is decided.
 */
import { gradeSelection, marketRuleFor } from '@/domain/market-rules';
import { serviceRoleContext } from '@/server/context';
import type { MatchResultStatus } from '@/domain/types';
import { computeBetPayout } from '@/domain/bet-settlement-math';
import { money } from '@/domain/money';
import { ApiError } from '@/lib/errors';
import type { ActorContext, Db } from '@/lib/ports/db';
import type { BettingRepository, CatalogRepository, SettleBetInput, SettleBetResult } from '@/lib/ports/repositories';
import type { Bet, BetGrade, UUID } from '@/lib/types';
import { createLogger } from '@/server/logger';

const log = createLogger({ component: 'settlement-service' });

const RESULT_STATUSES: string[] = ['finished', 'cancelled', 'abandoned', 'postponed', 'interrupted', 'corrected'];

export interface GradedBetPlan {
  betId: UUID;
  currency: string;
  stakeMinor: bigint;
  payoutMinor: bigint;
  status: 'settled' | 'void' | 'partially_settled' | 'manual_review';
  legs: { selectionId: UUID; grade: BetGrade; reason: string }[];
  manualReviewReason: string | null;
}

export interface SettlementServiceDeps {
  db: Db;
  betting: BettingRepository;
  catalog: CatalogRepository;
}

export class SettlementService {
  constructor(private readonly deps: SettlementServiceDeps) {}

  /**
   * Grade every leg of a bet from the authoritative result. Never guesses: any missing
   * or ambiguous fact produces MANUAL_REVIEW instead of a decision.
   */
  async plan(bet: Bet): Promise<GradedBetPlan> {
    const graded: { selectionId: UUID; grade: BetGrade; reason: string }[] = [];
    let manualReason: string | null = null;

    for (const leg of bet.legs) {
      const market = await this.deps.catalog.getMarket(serviceRoleContext, leg.marketId);
      const result = await this.deps.catalog.getResult(leg.matchId);
      const owner = await this.deps.db.queryOne<{
        provider: string | null;
        provider_id: string | null;
      }>(
        `select provider, provider_id from nova.matches where id = $1 limit 1`,
        [leg.matchId],
      );
      if (!market || !result) {
        manualReason = `MISSING_DATA:${!market ? `market:${leg.marketId}` : `result:${leg.matchId}`}`;
        graded.push({ selectionId: leg.selectionId, grade: 'MANUAL_REVIEW', reason: manualReason });
        continue;
      }
      if (
        !owner?.provider ||
        !owner.provider_id ||
        result.authoritative !== true ||
        !result.provider ||
        !result.providerResultId ||
        result.provider !== owner.provider ||
        result.providerResultId !== owner.provider_id
      ) {
        manualReason = `RESULT_PROVIDER_OWNERSHIP_OR_AUTHORITY_MISMATCH:${leg.matchId}`;
        log.error('settlement blocked by result ownership/authority check', {
          betId: bet.id,
          matchId: leg.matchId,
          matchProvider: owner?.provider ?? null,
          resultProvider: result.provider,
          authoritative: result.authoritative,
        });
        graded.push({ selectionId: leg.selectionId, grade: 'MANUAL_REVIEW', reason: manualReason });
        continue;
      }
      const selection = market.selections.find((s) => s.id === leg.selectionId);
      const rule = marketRuleFor(market.key) ?? marketRuleFor(market.type);
      if (!selection || !rule) {
        manualReason = `NO_RULE_OR_SELECTION:${market.key}`;
        graded.push({ selectionId: leg.selectionId, grade: 'MANUAL_REVIEW', reason: manualReason });
        continue;
      }
      // Only a finished/voided match can be graded; anything else stays pending.
      const resultStatus = RESULT_STATUSES.includes(result.status as MatchResultStatus)
        ? (result.status as MatchResultStatus)
        : null;
      if (!resultStatus) {
        manualReason = `RESULT_NOT_FINAL:${result.status}`;
        graded.push({ selectionId: leg.selectionId, grade: 'MANUAL_REVIEW', reason: manualReason });
        continue;
      }
      const decision = gradeSelection({
        rule,
        selection: { code: selection.code, line: selection.line, participantType: selection.participantType },
        result: {
          matchId: result.matchId, status: resultStatus, homeScore: result.homeScore, awayScore: result.awayScore,
          homeHalfScore: result.homeHalfScore, awayHalfScore: result.awayHalfScore,
          homeCorners: result.homeCorners, awayCorners: result.awayCorners,
          homeCards: result.homeCards, awayCards: result.awayCards,
          extraTime: result.extraTime, penalties: result.penalties,
          penaltyHome: result.penaltyHome, penaltyAway: result.penaltyAway,
          provider: result.provider, providerResultId: result.providerResultId, authoritative: result.authoritative,
          observedAt: new Date(result.observedAt), revision: result.revision,
        },
        matchStatus: resultStatus === 'finished' || resultStatus === 'corrected' ? 'finished' : resultStatus,
      });
      if (decision.grade === 'MANUAL_REVIEW' || decision.grade === 'PENDING') {
        manualReason = manualReason ?? decision.reason;
      }
      graded.push({ selectionId: leg.selectionId, grade: decision.grade as BetGrade, reason: decision.reason });
    }

    // Payout comes from the AUTHORITATIVE placement odds, never from the client.
    const math = computeBetPayout({
      stake: money(bet.stakeMinor, bet.currency),
      legs: bet.legs.map((leg, index) => ({
        selectionId: leg.selectionId,
        grade: (graded[index]?.grade ?? 'PENDING') as never,
        odds: leg.oddsAtPlacementScaled,
      })),
    });

    return {
      betId: bet.id,
      currency: bet.currency,
      stakeMinor: bet.stakeMinor,
      payoutMinor: manualReason ? 0n : math.payout.amount,
      status: manualReason ? 'manual_review' : (math.status as GradedBetPlan['status']),
      legs: graded,
      manualReviewReason: manualReason,
    };
  }

  /** Settle a bet: grade, price, then move money through the authoritative SQL path. */
  async settle(input: {
    betId: UUID; source: 'provider' | 'manual' | 'regrade' | 'system'; actorId?: UUID | null;
    idempotencyKey: string; note?: string | null; actor?: ActorContext;
  }): Promise<{ plan: GradedBetPlan; result: SettleBetResult | null }> {
    const bet = await this.deps.betting.getBet(serviceRoleContext, input.betId, null);
    if (!bet) throw new ApiError('BET_NOT_FOUND');
    if (['settled', 'void', 'cancelled', 'cashed_out', 'reversed'].includes(bet.status)) {
      // Already final: report the existing settlement instead of re-deciding it.
      const existing = await this.deps.betting.getBet(serviceRoleContext, input.betId, null);
      if (existing) {
        log.info('settlement skipped: bet already final', { betId: bet.id, status: bet.status });
        return {
          plan: {
            betId: bet.id, currency: bet.currency, stakeMinor: bet.stakeMinor,
            payoutMinor: existing.settledPayoutMinor ?? 0n, status: 'settled', legs: [],
            manualReviewReason: null,
          },
          result: null,
        };
      }
    }
    const plan = await this.plan(bet);
    if (plan.manualReviewReason) {
      log.warn('bet routed to manual review', { betId: bet.id, reason: plan.manualReviewReason });
      return { plan, result: null };
    }
    const payload: SettleBetInput = {
      betId: bet.id,
      revision: bet.revision + 1,
      source: input.source,
      legs: plan.legs.map((l) => ({
        selectionId: l.selectionId,
        grade: (l.grade === 'CANCELLED' ? 'VOID' : l.grade) as SettleBetInput['legs'][number]['grade'],
      })),
      payoutMinor: plan.payoutMinor.toString(),
      actorId: input.actorId ?? null,
      note: input.note ?? null,
      idempotencyKey: input.idempotencyKey,
    };
    const result = await this.deps.betting.settleBet(payload);
    log.info('bet settled', { betId: bet.id, status: result.status, payoutMinor: result.payoutMinor.toString() });
    return { plan, result };
  }

  /** Regrade: reverse the previous settlement (ledger + affiliate), then re-settle. */
  async regrade(input: { betId: UUID; reason: string; actorId: UUID; idempotencyKey: string }) {
    const bet = await this.deps.betting.getBet(serviceRoleContext, input.betId, null);
    if (!bet) throw new ApiError('BET_NOT_FOUND');
    const settlementRow = await this.deps.db.queryOne<{ id: string }>(
      `select id from nova.bet_settlements where bet_id = $1 and reversed_by is null order by settled_at desc limit 1`,
      [input.betId],
    );
    if (!settlementRow) throw new ApiError('REGRADE_NOT_ALLOWED', 'No reversible settlement found for this bet');
    const reversal = await this.deps.betting.reverseSettlement({
      betId: input.betId, settlementId: settlementRow.id, reason: input.reason,
      actorId: input.actorId, idempotencyKey: `${input.idempotencyKey}:reversal`,
    });
    const regraded = await this.settle({
      betId: input.betId, source: 'regrade', actorId: input.actorId,
      idempotencyKey: `${input.idempotencyKey}:resettle`, note: `regrade: ${input.reason}`,
    });
    return { reversal, ...regraded };
  }
}
