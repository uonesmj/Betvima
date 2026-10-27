import { describe, expect, it } from 'vitest';
import { casinoManualIdentityReviewSchema } from '../../src/server/kyc/casino-manual-review';

const approvedEvidence = {
  documentType: 'passport',
  reason: 'Government-issued photo ID inspected and age verified',
  telegramReference: 'request-2026-10-27-001',
  ageConfirmed: true,
  identityConfirmed: true,
  consentConfirmed: true,
};

describe('manual casino identity review', () => {
  it('accepts a complete operator-reviewed document attestation', () => {
    expect(casinoManualIdentityReviewSchema.safeParse(approvedEvidence).success).toBe(true);
  });

  it('refuses approval without age, identity or customer consent checks', () => {
    for (const key of ['ageConfirmed', 'identityConfirmed', 'consentConfirmed']) {
      expect(casinoManualIdentityReviewSchema.safeParse({ ...approvedEvidence, [key]: false }).success).toBe(false);
      expect(casinoManualIdentityReviewSchema.safeParse({ ...approvedEvidence, [key]: undefined }).success).toBe(false);
    }
  });

  it('requires a real document type and a review trail', () => {
    expect(casinoManualIdentityReviewSchema.safeParse({ ...approvedEvidence, documentType: 'other' }).success).toBe(false);
    expect(casinoManualIdentityReviewSchema.safeParse({ ...approvedEvidence, reason: 'ok' }).success).toBe(false);
    expect(casinoManualIdentityReviewSchema.safeParse({ ...approvedEvidence, telegramReference: '' }).success).toBe(false);
  });

  it('rejects client-supplied privilege/status overrides', () => {
    expect(casinoManualIdentityReviewSchema.safeParse({ ...approvedEvidence, kycStatus: 'verified' }).success).toBe(false);
  });
});
