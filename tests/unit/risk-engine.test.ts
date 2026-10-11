import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, evaluateRisk, type RiskContext } from '@/domain/risk-engine';
import { money } from '@/domain/money';

const base = (over: Partial<RiskContext> = {}): RiskContext => ({
  currency: 'IRT', userId: 'u1', isLive: false, sportId: 'sp1', leagueId: 'lg1', matchId: 'm1', marketIds: ['mk1'],
  stake: money(100_000n, 'IRT'), potentialPayout: money(250_000n, 'IRT'), odds: [25_000n],
  accountStatus: 'active', selfExcluded: false, coolingOffUntil: null, kycStatus: 'verified', ageVerified: true,
  jurisdiction: 'IR', blockedJurisdictions: [], dailyStakeMinor: 0n, dailyPayoutMinor: 0n,
  selectionExposureMinor: 0n, matchExposureMinor: 0n, marketExposureMinor: 0n, userExposureMinor: 0n,
  userDailyStakeLimitMinor: null, userLossLimitMinor: null, now: new Date('2026-01-01T12:00:00Z'),
  ...over,
});

describe('risk engine: account gates are absolute', () => {
  it('rejects self-excluded, suspended, restricted, under-age and non-compliant accounts', () => {
    expect(evaluateRisk(base({ selfExcluded: true })).decision).toBe('REJECT');
    expect(evaluateRisk(base({ accountStatus: 'suspended' })).reasons).toContain('ACCOUNT_SUSPENDED');
    expect(evaluateRisk(base({ accountStatus: 'restricted' })).reasons).toContain('ACCOUNT_RESTRICTED');
    expect(evaluateRisk(base({ ageVerified: false })).reasons).toContain('AGE_NOT_VERIFIED');
    expect(evaluateRisk(base({ kycStatus: 'rejected' })).reasons).toContain('KYC_INVALID');
    expect(evaluateRisk(base({ jurisdiction: 'US', blockedJurisdictions: ['US'] })).reasons).toContain('JURISDICTION_BLOCKED');
    expect(evaluateRisk(base({ coolingOffUntil: new Date('2026-01-02T00:00:00Z') })).reasons).toContain('ACCOUNT_COOLING_OFF');
  });
});

describe('risk engine: limits', () => {
  it('allows a normal bet', () => {
    const decision = evaluateRisk(base());
    expect(decision.decision).toBe('ALLOW');
    expect(decision.maxStakeAllowed?.amount).toBe(100_000n);
  });

  it('rejects a stake below the minimum', () => {
    expect(evaluateRisk(base({ stake: money(1_000n, 'IRT'), potentialPayout: money(2_500n, 'IRT') })).reasons)
      .toContain('STAKE_BELOW_MINIMUM');
  });

  it('limits an oversized stake to the smallest applicable cap', () => {
    const decision = evaluateRisk(base({
      stake: money(600_000_000n, 'IRT'), potentialPayout: money(1_200_000_000n, 'IRT'),
    }));
    expect(decision.decision).toBe('LIMIT');
    expect(decision.maxStakeAllowed?.amount).toBe(DEFAULT_LIMITS.maxStakeMinor);
    expect(decision.reasons).toContain('MAX_STAKE');
  });

  it('limits (not rejects) when the payout ceiling can be satisfied with a smaller stake', () => {
    const decision = evaluateRisk(base({
      stake: money(100_000_000n, 'IRT'),
      potentialPayout: money(5_000_000_000n, 'IRT'),   // 50x payout, ceiling is 2B -> stake scaled down
    }));
    expect(decision.decision).toBe('LIMIT');
    expect(decision.reasons).toContain('MAX_PAYOUT');
    expect((decision.maxStakeAllowed?.amount ?? 0n) < 100_000_000n).toBe(true);
    expect((decision.maxStakeAllowed?.amount ?? 0n) >= DEFAULT_LIMITS.minStakeMinor).toBe(true);
  });

  it('uses a stricter live stake cap', () => {
    const decision = evaluateRisk(base({ isLive: true, stake: money(150_000_000n, 'IRT') }));
    expect(decision.decision).toBe('LIMIT');
    expect(decision.maxStakeAllowed?.amount).toBe(DEFAULT_LIMITS.maxLiveStakeMinor);
  });

  it('enforces market/match/user exposure caps', () => {
    const decision = evaluateRisk(base({ marketExposureMinor: DEFAULT_LIMITS.maxMarketExposureMinor - 5_000n }));
    expect(decision.decision).toBe('LIMIT');
    expect(decision.maxStakeAllowed?.amount).toBe(5_000n);
    expect(evaluateRisk(base({ matchExposureMinor: DEFAULT_LIMITS.maxMatchExposureMinor + 1n })).decision).toBe('REJECT');
  });

  it('enforces daily stake limits and user-selected limits', () => {
    const daily = evaluateRisk(base({ dailyStakeMinor: DEFAULT_LIMITS.maxDailyStakeMinor - 10_000n }));
    expect(daily.decision).toBe('LIMIT');
    const userLimit = evaluateRisk(base({ userDailyStakeLimitMinor: 120_000n, dailyStakeMinor: 100_000n }));
    expect(userLimit.decision).toBe('LIMIT');
    expect(userLimit.maxStakeAllowed?.amount).toBe(20_000n);
  });

  it('sends abnormal payout ratios to manual review instead of silently blocking', () => {
    const decision = evaluateRisk(base({ stake: money(10_000n, 'IRT'), potentialPayout: money(3_000_000n, 'IRT') }));
    expect(decision.decision).toBe('MANUAL_REVIEW');
    expect(decision.requiresManualReview).toBe(true);
  });
});
