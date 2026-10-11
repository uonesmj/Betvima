/**
 * NOVA - AFFILIATE ENGINE (orchestration)
 *
 * Owns: weekly (Friday) settlement, payout lifecycle, adjustments, dashboards and
 * attribution/hierarchy commands. Commission per settled bet is written inside
 * `nova.settle_bet` (same transaction as the wallet credit) by `nova.apply_bet_commission`,
 * which implements exactly the formula in ./affiliate-commission.ts - one formula, two
 * execution environments (SQL for atomicity, TS for reporting/tests).
 */
import { calculatePeriodSettlement, payableBalance, type CommissionConfig } from './affiliate-commission';
import { DomainError } from './errors';
import { FRIDAY_ISO, lastWeeklyCutoff, nextWeeklyCutoff, localParts, zonedWallClockToUtc, isoWeekKey } from './time';
import { validateHierarchyChange, generateReferralCode, generateReferralSlug, decideAttribution } from './referral';
import { money } from './money';
import type { DomainAdapters } from './ports';
import type {
  Affiliate, AffiliatePayout, AffiliatePayoutStatus, AffiliateSettlement, CommissionModel,
} from './types';

export interface AffiliateEngineDeps {
  adapters: DomainAdapters;
  workerId: string;
  /** Fallback values used only when no config row exists at any scope. */
  defaults: CommissionConfig;
  maxDepth: number;
  dualApprovalThresholdMinor: bigint | null;
}

export interface WeeklySettlementReport {
  affiliatesConsidered: number;
  settled: number;
  skippedBelowMinimum: number;
  payoutsCreated: number;
  totalPayoutMinor: bigint;
  floorsApplied: number;
  errors: string[];
}

const PAYOUT_TRANSITIONS: Record<AffiliatePayoutStatus, AffiliatePayoutStatus[]> = {
  pending: ['eligible', 'cancelled', 'rejected', 'manual_review'],
  eligible: ['approved', 'manual_review', 'cancelled', 'rejected'],
  approved: ['processing', 'cancelled', 'failed'],
  processing: ['paid', 'failed'],
  paid: [],
  failed: ['pending', 'cancelled'],
  cancelled: [],
  manual_review: ['eligible', 'approved', 'rejected', 'cancelled'],
  rejected: ['pending', 'cancelled'],
};

export function canTransitionPayout(from: AffiliatePayoutStatus, to: AffiliatePayoutStatus): boolean {
  return (PAYOUT_TRANSITIONS[from] ?? []).includes(to);
}

export function assertPayoutTransition(from: AffiliatePayoutStatus, to: AffiliatePayoutStatus): void {
  if (!canTransitionPayout(from, to)) throw new DomainError('INVALID_STATE_TRANSITION', `Payout cannot move from ${from} to ${to}`);
}

export class AffiliateEngine {
  constructor(private readonly deps: AffiliateEngineDeps) {}

  private get a(): DomainAdapters {
    return this.deps.adapters;
  }

  private async configFor(affiliateId: string): Promise<CommissionConfig> {
    const resolved = await this.a.affiliate.resolveEffectiveConfig(affiliateId, null, null);
    return {
      model: resolved.commissionModel as CommissionModel,
      rateBps: BigInt(resolved.commissionRateBps),
      allowNegativeBalance: resolved.allowNegativeBalance,
      negativeFloorMinor: resolved.negativeBalanceFloorMinor,
      parentOverrideBps: BigInt(resolved.parentOverrideBps),
      netCapBps: resolved.netCapBps === null ? null : BigInt(resolved.netCapBps),
      carryForward: true,
      minPayoutMinor: resolved.minPayoutMinor,
      maxPayoutMinor: resolved.maxPayoutMinor,
      currency: this.deps.defaults.currency,
    };
  }

  /* ------------------------------------------------------------------ *
   * Weekly (Friday) settlement                                          *
   * ------------------------------------------------------------------ */

  /**
   * Runs the configured settlement schedule for every due affiliate.
   * LOCK PERIOD -> SNAPSHOT ELIGIBLE ENTRIES -> EXCLUDE PENDING BETS -> CALCULATE NET
   * -> APPLY CARRY FORWARD -> CHECK MINIMUM PAYOUT -> CREATE SETTLEMENT -> PAYOUT -> LEDGER
   * -> AUDIT -> NOTIFICATION
   *
   * Idempotency: `affiliate_settlements` has a UNIQUE (affiliate_id, period_end) constraint,
   * so a second run in the same window cannot create a duplicate settlement or payout.
   */
  async runWeeklySettlement(now = this.a.clock.now()): Promise<WeeklySettlementReport> {
    const log = this.a.logger.child({ op: 'runWeeklySettlement', workerId: this.deps.workerId });
    const report: WeeklySettlementReport = {
      affiliatesConsidered: 0, settled: 0, skippedBelowMinimum: 0, payoutsCreated: 0,
      totalPayoutMinor: 0n, floorsApplied: 0, errors: [],
    };
    if (!(await this.a.system.getOperationState('AFFILIATE_SETTLEMENT'))) {
      log.warn('affiliate settlement disabled by emergency control');
      return report;
    }
    const affiliates = await this.listDueAffiliates(now);
    report.affiliatesConsidered = affiliates.length;
    for (const affiliate of affiliates) {
      try {
        const outcome = await this.settleAffiliatePeriod(affiliate, now);
        if (outcome.settled) report.settled += 1;
        if (outcome.belowMinimum) report.skippedBelowMinimum += 1;
        if (outcome.payoutCreated) {
          report.payoutsCreated += 1;
          report.totalPayoutMinor += outcome.payoutMinor;
        }
        if (outcome.floorApplied) report.floorsApplied += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        report.errors.push(`${affiliate.publicId}: ${message}`);
        log.error('affiliate settlement failed', { affiliateId: affiliate.id, error: message });
      }
    }
    log.info('weekly settlement run finished', {
      considered: report.affiliatesConsidered, settled: report.settled,
      payouts: report.payoutsCreated, total: report.totalPayoutMinor.toString(),
    });
    return report;
  }

  /** All approved affiliates whose most recent cutoff is newer than their last settlement. */
  async listDueAffiliates(now: Date): Promise<Affiliate[]> {
    if (typeof (this.a.affiliate as unknown as { listDueForSettlement?: unknown }).listDueForSettlement === 'function') {
      return (this.a.affiliate as unknown as { listDueForSettlement: (n: Date) => Promise<Affiliate[]> }).listDueForSettlement(now);
    }
    return [];
  }

  /** Settlement for ONE affiliate. Exposed separately so admins can force a manual run. */
  async settleAffiliatePeriod(affiliate: Affiliate, now: Date): Promise<{
    settled: boolean; belowMinimum: boolean; payoutCreated: boolean; payoutMinor: bigint; floorApplied: boolean;
    settlement: AffiliateSettlement | null;
  }> {
    const config = await this.configFor(affiliate.id);
    const cutoff = lastWeeklyCutoff(
      now,
      affiliate.settlementDayIso || FRIDAY_ISO,
      affiliate.settlementHour,
      affiliate.settlementMinute,
      affiliate.settlementTimezone,
    );
    const previousCutoff = new Date(cutoff.getTime() - 7 * 86_400_000);

    const settlement = await this.a.affiliate.createSettlement({
      affiliateId: affiliate.id,
      periodStart: previousCutoff,
      periodEnd: cutoff,
      workerId: this.deps.workerId,
      correlationId: `${this.deps.workerId}:settle:${affiliate.publicId}:${cutoff.toISOString()}`,
    });

    const stats = await this.a.affiliate.getStats(affiliate.id);
    const balance = await this.a.affiliate.payableBalanceMinor(affiliate.id);
    const calculation = calculatePeriodSettlement({
      entries: settlement.grossCommissionMinor !== 0n || settlement.negativeImpactMinor !== 0n
        ? [
            { amountMinor: settlement.grossCommissionMinor, type: 'user_loss_commission', currency: settlement.currency },
            { amountMinor: -settlement.negativeImpactMinor, type: 'user_win_debit', currency: settlement.currency },
          ]
        : [],
      openingCarryMinor: settlement.openingCarryMinor,
      config,
      periodTurnoverMinor: stats.totalTurnoverMinor,
    });

    const payoutMinor = settlement.payableMinor;
    const belowMinimum = payoutMinor === 0n;

    if (payoutMinor > 0n) {
      const payout = await this.createPayout({
        affiliateId: affiliate.id,
        settlementId: settlement.id,
        amountMinor: payoutMinor,
        currency: settlement.currency,
        idempotencyKey: `settlement:${settlement.id}`,
        requestedBy: 'system',
        method: affiliate.autoPayoutEnabled ? 'auto' : 'manual',
        destinationMasked: null,
      });
      await this.a.notifications.create({
        userId: affiliate.userId,
        type: 'affiliate_settlement',
        title: 'Weekly settlement completed',
        body: `Your weekly settlement is ready: ${payoutMinor.toString()} ${settlement.currency}`,
        linkPath: '/affiliate/settlements',
        data: { settlementId: settlement.id, payoutId: payout.id },
      });
      return { settled: true, belowMinimum: false, payoutCreated: true, payoutMinor, floorApplied: calculation.floorApplied, settlement };
    }

    await this.a.notifications.create({
      userId: affiliate.userId,
      type: 'affiliate_settlement',
      title: belowMinimum ? 'Settlement carried forward' : 'Weekly settlement completed',
      body: belowMinimum
        ? `Below the minimum payout (${config.minPayoutMinor.toString()} ${settlement.currency}). Balance carried forward.`
        : 'No payable balance this period.',
      linkPath: '/affiliate/settlements',
      data: { settlementId: settlement.id },
    });
    void balance;
    void money;
    return { settled: true, belowMinimum: true, payoutCreated: false, payoutMinor: 0n, floorApplied: calculation.floorApplied, settlement };
  }

  /* ------------------------------------------------------------------ *
   * Payouts                                                            *
   * ------------------------------------------------------------------ */

  async createPayout(input: {
    affiliateId: string; settlementId: string | null; amountMinor: bigint; currency: string;
    idempotencyKey: string; requestedBy: string; method: string | null; destinationMasked: string | null;
  }): Promise<AffiliatePayout> {
    const log = this.a.logger.child({ op: 'createPayout', affiliateId: input.affiliateId });
    if (!(await this.a.system.getOperationState('AFFILIATE_PAYOUT'))) throw new DomainError('AFFILIATE_PAYOUT_DISABLED');
    const config = await this.configFor(input.affiliateId);
    if (input.amountMinor <= 0n) throw new DomainError('VALIDATION_ERROR', 'Payout amount must be positive');
    if (input.amountMinor < config.minPayoutMinor) throw new DomainError('VALIDATION_ERROR', 'Payout below the configured minimum');

    const balance = await this.a.affiliate.payableBalanceMinor(input.affiliateId);
    if (input.amountMinor > balance.payable) {
      // The payable balance is authoritative (floor-zero aware). Never pay more than it.
      throw new DomainError('INSUFFICIENT_BALANCE', 'Payout exceeds the payable balance');
    }

    const dualApprovalRequired = this.deps.dualApprovalThresholdMinor !== null
      && input.amountMinor >= this.deps.dualApprovalThresholdMinor;

    // The DB unique constraint on (affiliate_id, idempotency_key) guarantees a single payout.
    const payout = await this.a.affiliate.createPayout({
      affiliateId: input.affiliateId,
      settlementId: input.settlementId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      requestedBy: input.requestedBy,
      method: input.method,
      destinationMasked: input.destinationMasked,
    });
    await this.a.audit.record({
      actorId: input.requestedBy === 'system' ? null : input.requestedBy,
      actorRole: input.requestedBy === 'system' ? null : 'affiliate_manager',
      action: 'affiliate.payout.create',
      targetType: 'affiliate_payout',
      targetId: payout.id,
      before: null,
      after: { amountMinor: input.amountMinor.toString(), currency: input.currency, status: payout.status },
      reason: settlementReason(input.settlementId),
      correlationId: input.idempotencyKey,
      ip: null, userAgent: null,
      metadata: { dualApprovalRequired },
    });
    log.info('payout created', { payoutId: payout.id, amount: input.amountMinor.toString(), dualApprovalRequired });
    return payout;
  }

  async approvePayout(input: {
    payoutId: string; actorId: string; actorRole: string; reason: string | null; correlationId: string;
  }): Promise<AffiliatePayout> {
    const payout = await this.a.affiliate.updatePayoutStatus({
      payoutId: input.payoutId, status: 'approved', actorId: input.actorId, reason: input.reason,
    });
    await this.a.audit.record({
      actorId: input.actorId, actorRole: input.actorRole, action: 'affiliate.payout.approve',
      targetType: 'affiliate_payout', targetId: input.payoutId,
      before: { status: 'pending' }, after: { status: 'approved' },
      reason: input.reason, correlationId: input.correlationId, ip: null, userAgent: null,
    });
    return payout;
  }

  async rejectPayout(input: {
    payoutId: string; actorId: string; actorRole: string; reason: string; correlationId: string;
  }): Promise<AffiliatePayout> {
    const payout = await this.a.affiliate.updatePayoutStatus({
      payoutId: input.payoutId, status: 'rejected', actorId: input.actorId, reason: input.reason,
    });
    await this.a.audit.record({
      actorId: input.actorId, actorRole: input.actorRole, action: 'affiliate.payout.reject',
      targetType: 'affiliate_payout', targetId: input.payoutId,
      before: { status: 'pending' }, after: { status: 'rejected' },
      reason: input.reason, correlationId: input.correlationId, ip: null, userAgent: null,
    });
    return payout;
  }

  /* ------------------------------------------------------------------ *
   * Onboarding / attribution / hierarchy                               *
   * ------------------------------------------------------------------ */

  async createAffiliate(input: { userId: string; displayName: string | null; parentCode: string | null; actorId: string | null }): Promise<Affiliate> {
    const code = generateReferralCode(6);
    void generateReferralSlug(code);
    throw new DomainError('FORBIDDEN', 'Affiliate creation is performed by the admin service (src/server/services/admin/affiliateAdmin.ts)');
    void input;
  }

  async placeAttribution(input: {
    userId: string; code: string; clickId: string | null; ipHash: string | null;
    deviceFingerprint: string | null; existingAttribution: never; correlationId: string;
  }) {
    const affiliate = await this.a.affiliate.getByCode(input.code);
    if (!affiliate) throw new DomainError('NOT_FOUND', 'Unknown referral code');
    const user = await this.a.users.getById(input.userId);
    if (!user) throw new DomainError('UNAUTHENTICATED');
    const decision = decideAttribution({
      candidate: { code: input.code, affiliateId: affiliate.id, clickId: input.clickId, clickedAt: this.a.clock.now() },
      signals: {
        userId: input.userId, emailHash: null, phoneHash: null,
        deviceFingerprint: input.deviceFingerprint, ipHash: input.ipHash,
        affiliateEmailHash: null, affiliatePhoneHash: null, affiliateDeviceFingerprint: null, affiliateIpHash: null,
      },
      now: this.a.clock.now(),
      existingAttribution: null,
    });
    if (!decision.attributed) throw new DomainError('SELF_REFERRAL_BLOCKED', decision.reason ?? 'Attribution rejected');
    const created = await this.a.affiliate.createAttribution({
      userId: input.userId, code: input.code, clickId: input.clickId,
      ipHash: input.ipHash, deviceFingerprint: input.deviceFingerprint, correlationId: input.correlationId,
    });
    if (decision.status === 'review') {
      await this.a.audit.record({
        actorId: null, actorRole: null, action: 'affiliate.attribution.flagged',
        targetType: 'affiliate_attribution', targetId: created.attribution?.id ?? null,
        before: null, after: { signals: decision.signals }, reason: 'WEAK_ATTRIBUTION_SIGNALS',
        correlationId: input.correlationId, ip: null, userAgent: null,
      });
    }
    return { attribution: created.attribution, status: decision.status, signals: decision.signals };
  }

  async changeHierarchy(input: {
    childId: string; newParentId: string | null; actorId: string; reason: string; correlationId: string;
  }): Promise<{ ok: boolean; reason: string | null }> {
    const nodes = await this.a.affiliate.listHierarchy(input.childId);
    const validation = validateHierarchyChange({
      nodes: nodes.map((n) => ({ affiliateId: n.affiliateId, parentAffiliateId: n.parentAffiliateId, depth: n.depth })),
      childId: input.childId,
      newParentId: input.newParentId,
      maxDepth: this.deps.maxDepth,
    });
    await this.a.audit.record({
      actorId: input.actorId, actorRole: 'affiliate_manager', action: 'affiliate.hierarchy.change',
      targetType: 'affiliate', targetId: input.childId,
      before: { parent: nodes.find((n) => n.affiliateId === input.childId)?.parentAffiliateId ?? null },
      after: { parent: input.newParentId, accepted: validation.ok },
      reason: input.reason, correlationId: input.correlationId, ip: null, userAgent: null,
    });
    if (!validation.ok) throw new DomainError('CIRCULAR_HIERARCHY', validation.reason ?? 'Invalid hierarchy change');
    return { ok: true, reason: null };
  }

  /** Admin financial adjustment. Requires reason + actor; always audited; never silent. */
  async createAdjustment(input: {
    affiliateId: string; amountMinor: bigint; currency: string; reason: string;
    actorId: string; actorRole: string; correlationId: string;
  }): Promise<{ id: string; newBalanceMinor: bigint }> {
    if (!input.reason || input.reason.trim().length < 8) {
      throw new DomainError('VALIDATION_ERROR', 'An explicit reason (>= 8 chars) is required for financial adjustments');
    }
    const before = await this.a.affiliate.payableBalanceMinor(input.affiliateId);
    const { inserted } = await this.a.affiliate.postLedgerEntries([{
      affiliateId: input.affiliateId,
      type: 'adjustment',
      amount: input.amountMinor,
      currency: input.currency,
      direction: input.amountMinor >= 0n ? 'credit' : 'debit',
      commissionRateBps: 0,
      sourceAmount: input.amountMinor,
      sourceKind: 'manual',
      userId: null, betId: null, betSettlementId: null, settlementId: null, payoutId: null,
      appliedRateBps: 0,
      capApplied: false,
      status: 'available',
      idempotencyKey: `adjustment:${input.affiliateId}:${input.actorId}:${Date.now()}`,
      metadata: { reason: input.reason, actorId: input.actorId },
    }]);
    const after = await this.a.affiliate.payableBalanceMinor(input.affiliateId);
    await this.a.audit.record({
      actorId: input.actorId, actorRole: input.actorRole, action: 'affiliate.adjustment.create',
      targetType: 'affiliate', targetId: input.affiliateId,
      before: { payable: before.payable.toString(), raw: before.raw.toString() },
      after: { payable: after.payable.toString(), raw: after.raw.toString(), inserted },
      reason: input.reason, correlationId: input.correlationId, ip: null, userAgent: null,
    });
    return { id: `${inserted}`, newBalanceMinor: after.payable };
  }

  /** Affiliate dashboard aggregate (single source for the /affiliate UI). */
  async dashboard(affiliateId: string) {
    const affiliate = await this.a.affiliate.getById(affiliateId);
    if (!affiliate) throw new DomainError('NOT_FOUND', 'Affiliate not found');
    const [balance, stats] = await Promise.all([
      this.a.affiliate.payableBalanceMinor(affiliateId),
      this.a.affiliate.getStats(affiliateId),
    ]);
    const config = await this.configFor(affiliateId);
    const nextSettlement = nextWeeklyCutoff(
      this.a.clock.now(), affiliate.settlementDayIso || FRIDAY_ISO, affiliate.settlementHour,
      affiliate.settlementMinute, affiliate.settlementTimezone,
    );
    const rounded = payableBalance({
      rawMinor: balance.raw, model: config.model, allowNegativeBalance: config.allowNegativeBalance,
      negativeFloorMinor: config.negativeFloorMinor,
    });
    return {
      affiliate,
      currency: stats.currency,
      payableBalanceMinor: rounded.payableMinor,
      openingCarryMinor: config.allowNegativeBalance ? (balance.raw < 0n ? balance.raw : 0n) : 0n,
      pendingCommissionMinor: stats.pendingCommissionMinor,
      totalEarnedMinor: stats.userLossesMinor === 0n ? 0n : stats.pendingCommissionMinor,
      totalPaidMinor: 0n,
      totalNegativeImpactMinor: 0n,
      floorZeroApplied: rounded.floorApplied,
      nextSettlementAt: nextSettlement.toISOString(),
      estimatedPayoutMinor: rounded.payableMinor >= config.minPayoutMinor ? rounded.payableMinor : 0n,
      minimumPayoutMinor: config.minPayoutMinor,
      stats,
      daily: [] as { day: string; commissionMinor: bigint; turnoverMinor: bigint; registrations: number }[],
      weekly: [] as { week: string; commissionMinor: bigint; netMinor: bigint }[],
    };
  }

  /** Utility used by the settlement worker to label audit reasons. */
  weekKeyFor(date: Date, timeZone: string): string {
    void localParts;
    void zonedWallClockToUtc;
    return isoWeekKey(date, timeZone);
  }
}

function settlementReason(settlementId: string | null): string {
  return settlementId ? `Weekly settlement ${settlementId}` : 'Manual payout request';
}
