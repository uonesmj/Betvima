import { describe, expect, it } from 'vitest';
import {
  decideAttribution, generateReferralCode, isValidReferralCode, subtreeHeightOf,
  validateHierarchyChange, MAX_AFFILIATE_DEPTH_DEFAULT, type HierarchyNode,
} from '@/domain/referral';
import {
  FRIDAY_ISO, FixedClock, dayKey, isoWeekKey, lastWeeklyCutoff, localParts, nextWeeklyCutoff,
  timeZoneOffsetMs, weeklyPeriodEndingAt, zonedWallClockToUtc,
} from '@/domain/time';

describe('referral: attribution decisions', () => {
  const now = new Date('2026-02-01T10:00:00Z');
  const candidate = { code: 'ABC123', affiliateId: 'aff1', clickId: 'click1', clickedAt: new Date('2026-01-30T10:00:00Z') };
  const signals = {
    userId: 'u1', emailHash: null, phoneHash: null, deviceFingerprint: 'dev-1', ipHash: 'ip-1',
    affiliateEmailHash: null, affiliatePhoneHash: null, affiliateDeviceFingerprint: 'dev-aff', affiliateIpHash: 'ip-aff',
  };

  it('confirms a clean referral', () => {
    const decision = decideAttribution({ candidate, signals, now, existingAttribution: null });
    expect(decision.attributed).toBe(true);
    expect(decision.status).toBe('confirmed');
  });

  it('blocks self-referral on strong signals (device)', () => {
    const decision = decideAttribution({
      candidate, signals: { ...signals, deviceFingerprint: 'dev-aff' }, now, existingAttribution: null,
    });
    expect(decision.attributed).toBe(false);
    expect(decision.reason).toBe('SELF_REFERRAL_BLOCKED');
    expect(decision.signals).toContain('SELF_REFERRAL_DEVICE');
  });

  it('routes weak signals (shared IP) to review instead of an automatic block', () => {
    const decision = decideAttribution({
      candidate, signals: { ...signals, ipHash: 'ip-aff' }, now, existingAttribution: null,
    });
    expect(decision.attributed).toBe(true);
    expect(decision.status).toBe('review');
    expect(decision.signals).toContain('SAME_IP');
  });

  it('rejects expired clicks, missing clicks and second attributions', () => {
    const expired = decideAttribution({
      candidate: { ...candidate, clickedAt: new Date('2025-01-01T10:00:00Z') }, signals, now, existingAttribution: null,
    });
    expect(expired.reason).toBe('ATTRIBUTION_WINDOW_EXPIRED');
    const noClick = decideAttribution({ candidate: { ...candidate, clickId: null }, signals, now, existingAttribution: null });
    expect(noClick.reason).toBe('NO_ATTRIBUTABLE_CLICK');
    const second = decideAttribution({
      candidate, signals, now,
      existingAttribution: {
        id: 'a1', affiliateId: 'aff0', linkId: null, userId: 'u1', code: 'OTHER', campaign: null,
        status: 'confirmed', clickId: 'c0', ipHash: null, deviceFingerprint: null, confirmedAt: now.toISOString(),
        lockedAt: now.toISOString(), isImmutable: true, rejectionReason: null, createdAt: now.toISOString(),
      },
    });
    expect(second.reason).toBe('ALREADY_ATTRIBUTED');
  });

  it('generates unambiguous codes', () => {
    const code = generateReferralCode(6);
    expect(code).toHaveLength(6);
    expect(isValidReferralCode(code)).toBe(true);
    expect(isValidReferralCode('ab')).toBe(false);
    expect(/[01IO]/.test(generateReferralCode(50))).toBe(false);
  });
});

describe('referral: hierarchy integrity', () => {
  const nodes: HierarchyNode[] = [
    { affiliateId: 'a', parentAffiliateId: null, depth: 0 },
    { affiliateId: 'b', parentAffiliateId: 'a', depth: 1 },
    { affiliateId: 'c', parentAffiliateId: 'b', depth: 2 },
  ];

  it('accepts a valid re-parent', () => {
    expect(validateHierarchyChange({ nodes, childId: 'c', newParentId: 'a' }).ok).toBe(true);
  });

  it('rejects self-parenting, cycles and descendants-as-parents', () => {
    expect(validateHierarchyChange({ nodes, childId: 'a', newParentId: 'a' }).reason).toBe('SELF_PARENT');
    expect(validateHierarchyChange({ nodes, childId: 'a', newParentId: 'b' }).reason).toBe('CIRCULAR_HIERARCHY');
    expect(validateHierarchyChange({ nodes, childId: 'a', newParentId: 'c' }).reason).toBe('CIRCULAR_HIERARCHY');
  });

  it('enforces the maximum depth', () => {
    const deep: HierarchyNode[] = [
      { affiliateId: 'l0', parentAffiliateId: null, depth: 0 },
      { affiliateId: 'l1', parentAffiliateId: 'l0', depth: 1 },
      { affiliateId: 'l2', parentAffiliateId: 'l1', depth: 2 },
      { affiliateId: 'l3', parentAffiliateId: 'l2', depth: 3 },
      { affiliateId: 'x', parentAffiliateId: null, depth: 0 },
    ];
    const result = validateHierarchyChange({ nodes: deep, childId: 'x', newParentId: 'l3', maxDepth: MAX_AFFILIATE_DEPTH_DEFAULT });
    expect(result.reason).toBe('MAX_DEPTH_EXCEEDED');
  });

  it('measures subtree height', () => {
    expect(subtreeHeightOf(nodes, 'a')).toBe(2);
    expect(subtreeHeightOf(nodes, 'c')).toBe(0);
  });
});

describe('time: Friday (weekly) settlement scheduling', () => {
  it('computes the weekly cutoff in the configured timezone', () => {
    // 2026-01-30 is a Friday
    const now = new Date('2026-02-01T10:00:00Z'); // Sunday
    const cutoff = lastWeeklyCutoff(now, FRIDAY_ISO, 3, 0, 'Asia/Tehran');
    const parts = localParts(cutoff, 'Asia/Tehran');
    expect(parts.isoWeekday).toBe(5);
    expect(parts.hour).toBe(3);
    expect(parts.minute).toBe(0);
  });

  it('returns the next Friday when the cutoff has passed', () => {
    const now = new Date('2026-01-30T05:00:00Z'); // Friday after 03:00 Tehran (00:30 UTC + 3:30 = 04:00... use 05:00 UTC = 08:30 Tehran)
    const next = nextWeeklyCutoff(now, FRIDAY_ISO, 3, 0, 'Asia/Tehran');
    expect(localParts(next, 'Asia/Tehran').isoWeekday).toBe(5);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it('produces a 7-day rolling period ending at the cutoff', () => {
    const end = { year: 2026, month: 1, day: 30, hour: 3, minute: 0 };
    const period = weeklyPeriodEndingAt(end, 'Asia/Tehran', 7);
    expect(Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000)).toBe(7);
    expect(period.end.getTime()).toBe(zonedWallClockToUtc(end, 'Asia/Tehran').getTime());
  });

  it('handles zone offsets and day/week keys deterministically', () => {
    expect(timeZoneOffsetMs(new Date('2026-01-15T00:00:00Z'), 'UTC')).toBe(0);
    expect(timeZoneOffsetMs(new Date('2026-01-15T00:00:00Z'), 'Asia/Tehran')).toBe(3.5 * 3_600_000);
    expect(dayKey(new Date('2026-01-15T22:00:00Z'), 'Asia/Tehran')).toBe('2026-01-16'); // crosses midnight locally
    expect(isoWeekKey(new Date('2026-01-15T00:00:00Z'), 'UTC')).toMatch(/^2026-W0[0-9]$/);
  });

  it('uses a UTC-anchored clock by default', () => {
    const clock = new FixedClock('2026-01-30T00:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-01-30T00:00:00.000Z');
    clock.advanceMs(1000);
    expect(clock.now().toISOString()).toBe('2026-01-30T00:00:01.000Z');
  });
});
