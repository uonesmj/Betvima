/**
 * NOVA - CENTRALISED RISK ENGINE
 *
 * Every stake is evaluated server-side against configured limits. The decision is one of
 *   ALLOW | LIMIT | REJECT | MANUAL_REVIEW
 * and the approved stake returned here is the ONLY stake the betting engine will accept.
 * Client-provided stake/limits are never trusted (rules 19, 25).
 */
import { money, compare, type Money } from './money';
import type { OddsScaled } from './odds';
import type { RiskDecision, RiskDecisionType } from './types';

export interface RiskContext {
  currency: string;
  userId: string;
  isLive: boolean;
  sportId: string | null;
  leagueId: string | null;
  matchId: string | null;
  marketIds: string[];
  stake: Money;
  /** Stake * combined odds - the platform's maximum liability on this slip. */
  potentialPayout: Money;
  odds: OddsScaled[];
  accountStatus: string;
  selfExcluded: boolean;
  coolingOffUntil: Date | null;
  kycStatus: string;
  ageVerified: boolean;
  jurisdiction: string | null;
  blockedJurisdictions: readonly string[];
  /** Rolling 24h aggregates. */
  dailyStakeMinor: bigint;
  dailyPayoutMinor: bigint;
  /** Existing liability on the same selections before this bet. */
  selectionExposureMinor: bigint;
  matchExposureMinor: bigint;
  marketExposureMinor: bigint;
  userExposureMinor: bigint;
  /** User-configured responsible-gaming limits (take precedence over platform minimums). */
  userDailyStakeLimitMinor: bigint | null;
  userLossLimitMinor: bigint | null;
  now: Date;
}

export interface ResolvedRiskLimits {
  minStakeMinor: bigint;
  maxStakeMinor: bigint;
  maxPayoutMinor: bigint;
  maxLiveStakeMinor: bigint;
  maxMarketExposureMinor: bigint;
  maxMatchExposureMinor: bigint;
  maxUserExposureMinor: bigint;
  maxDailyStakeMinor: bigint;
  maxDailyPayoutMinor: bigint;
  /** stake / payout ratio below which accelerated review triggers. */
  suspiciousPayoutRatioBps: bigint;
}

export const DEFAULT_LIMITS: ResolvedRiskLimits = {
  minStakeMinor: 10_000n,          // 10,000 IRT
  maxStakeMinor: 500_000_000n,     // 500,000,000 IRT
  maxPayoutMinor: 2_000_000_000n,  // 2,000,000,000 IRT per bet
  maxLiveStakeMinor: 100_000_000n,
  maxMarketExposureMinor: 5_000_000_000n,
  maxMatchExposureMinor: 7_500_000_000n,
  maxUserExposureMinor: 2_000_000_000n,
  maxDailyStakeMinor: 1_000_000_000n,
  maxDailyPayoutMinor: 5_000_000_000n,
  suspiciousPayoutRatioBps: 200_000n, // payout > 20x stake gets flagged, not blocked
};

export interface RiskRuleConfig {
  /** Optional per-scope overrides resolved by the caller from `risk_rules`. */
  limits: ResolvedRiskLimits;
  requireManualReviewAboveMinor: bigint | null;
  enabled: boolean;
}

export const DEFAULT_RISK_RULE_CONFIG: RiskRuleConfig = {
  limits: DEFAULT_LIMITS,
  requireManualReviewAboveMinor: null,
  enabled: true,
};

/**
 * Evaluate a bet. Deterministic, pure, fully unit-tested.
 * Order: account gates -> stake sanity -> platform limits -> responsible gaming -> exposure.
 */
export function evaluateRisk(ctx: RiskContext, rule: RiskRuleConfig = DEFAULT_RISK_RULE_CONFIG): RiskDecision {
  const reasons: string[] = [];
  const limits = rule.limits;
  const stakeMinor = ctx.stake.amount;
  const payoutMinor = ctx.potentialPayout.amount;

  const hardReject = (code: string): RiskDecision => ({
    decision: 'REJECT', maxStakeAllowed: null, reasons: [...reasons, code], ruleIds: [], requiresManualReview: false,
  });
  const manualReview = (code: string): RiskDecision => ({
    decision: 'MANUAL_REVIEW', maxStakeAllowed: null, reasons: [...reasons, code], ruleIds: [], requiresManualReview: true,
  });
  const limitTo = (minor: bigint, code: string): RiskDecision => ({
    decision: 'LIMIT',
    maxStakeAllowed: money(minor, ctx.currency),
    reasons: [...reasons, code],
    ruleIds: [],
    requiresManualReview: false,
  });

  /* -------- account gates (absolute) -------- */
  if (ctx.selfExcluded) return hardReject('ACCOUNT_SELF_EXCLUDED');
  if (ctx.coolingOffUntil && ctx.coolingOffUntil.getTime() > ctx.now.getTime()) return hardReject('ACCOUNT_COOLING_OFF');
  if (ctx.accountStatus === 'suspended' || ctx.accountStatus === 'closed') return hardReject('ACCOUNT_SUSPENDED');
  if (ctx.accountStatus === 'restricted') return hardReject('ACCOUNT_RESTRICTED');
  if (!ctx.ageVerified) return hardReject('AGE_NOT_VERIFIED');
  if (ctx.kycStatus === 'rejected' || ctx.kycStatus === 'expired') return hardReject('KYC_INVALID');
  if (ctx.jurisdiction && ctx.blockedJurisdictions.includes(ctx.jurisdiction)) return hardReject('JURISDICTION_BLOCKED');

  if (!rule.enabled) return { decision: 'ALLOW', maxStakeAllowed: null, reasons: ['RISK_ENGINE_DISABLED'], ruleIds: [], requiresManualReview: false };

  /* -------- stake sanity -------- */
  if (stakeMinor <= 0n) return hardReject('STAKE_NOT_POSITIVE');
  if (compare(ctx.stake, money(limits.minStakeMinor, ctx.currency)) < 0) {
    return { decision: 'REJECT', maxStakeAllowed: null, reasons: ['STAKE_BELOW_MINIMUM'], ruleIds: [], requiresManualReview: false };
  }

  /* -------- payable limits, collected as candidate caps -------- */
  const caps: { minor: bigint; code: string }[] = [];
  caps.push({ minor: limits.maxStakeMinor, code: 'MAX_STAKE' });
  caps.push({ minor: limits.maxMarketExposureMinor - ctx.marketExposureMinor, code: 'MAX_MARKET_EXPOSURE' });
  caps.push({ minor: limits.maxMatchExposureMinor - ctx.matchExposureMinor, code: 'MAX_MATCH_EXPOSURE' });
  caps.push({ minor: limits.maxUserExposureMinor - ctx.userExposureMinor, code: 'MAX_USER_EXPOSURE' });
  caps.push({ minor: limits.maxDailyStakeMinor - ctx.dailyStakeMinor, code: 'MAX_DAILY_STAKE' });
  if (ctx.isLive) caps.push({ minor: limits.maxLiveStakeMinor, code: 'MAX_LIVE_STAKE' });
  if (ctx.userDailyStakeLimitMinor !== null) caps.push({ minor: ctx.userDailyStakeLimitMinor - ctx.dailyStakeMinor, code: 'USER_DAILY_STAKE_LIMIT' });

  const effectiveCap = caps.reduce((acc, c) => (c.minor < acc.minor ? c : acc), caps[0]!);

  if (effectiveCap.minor <= 0n) {
    reasons.push(effectiveCap.code);
    return hardReject(effectiveCap.code);
  }
  if (stakeMinor > effectiveCap.minor) {
    return limitTo(effectiveCap.minor, effectiveCap.code);
  }

  /* -------- payout ceiling: LIMIT if reducible, REJECT if structurally impossible -------- */
  if (payoutMinor > limits.maxPayoutMinor) {
    // Odds are fixed for the slip: the only lever is stake. Reduce the stake so the payout fits.
    if (payoutMinor > 0n && stakeMinor > 0n) {
      const scaledStake = (stakeMinor * limits.maxPayoutMinor) / payoutMinor;
      if (scaledStake >= limits.minStakeMinor) return limitTo(scaledStake, 'MAX_PAYOUT');
    }
    return hardReject('PAYOUT_ABOVE_MAXIMUM');
  }

  /* -------- responsible gaming: loss-limit proxy via daily payout -------- */
  if (ctx.userLossLimitMinor !== null && ctx.dailyPayoutMinor - ctx.dailyStakeMinor < -ctx.userLossLimitMinor) {
    return hardReject('USER_LOSS_LIMIT_REACHED');
  }
  if (ctx.dailyPayoutMinor > limits.maxDailyPayoutMinor) return hardReject('MAX_DAILY_PAYOUT');

  /* -------- anomaly signals -> manual review, never silent block -------- */
  if (rule.requireManualReviewAboveMinor !== null && stakeMinor >= rule.requireManualReviewAboveMinor) {
    return manualReview('STAKE_ABOVE_MANUAL_REVIEW_THRESHOLD');
  }
  if (payoutMinor > 0n && stakeMinor > 0n) {
    const ratioBps = (payoutMinor * 10_000n) / stakeMinor;
    if (ratioBps > limits.suspiciousPayoutRatioBps) {
      reasons.push('HIGH_PAYOUT_RATIO');
      return manualReview('HIGH_PAYOUT_RATIO');
    }
  }

  return { decision: 'ALLOW', maxStakeAllowed: ctx.stake, reasons: reasons.length ? reasons : ['OK'], ruleIds: [], requiresManualReview: false };
}

export function decisionBlocksPlacement(decision: RiskDecisionType): boolean {
  return decision === 'REJECT' || decision === 'MANUAL_REVIEW';
}

export function decisionFromLimits(currency: string, limits: Partial<ResolvedRiskLimits>): ResolvedRiskLimits {
  return { ...DEFAULT_LIMITS, ...limits, minStakeMinor: limits.minStakeMinor ?? DEFAULT_LIMITS.minStakeMinor };
}
