import { describe, expect, it } from 'vitest';
import { publicRegistrationOutcome, registrationLogSummary } from '@/server/auth/registration-output';

describe('registration output privacy', () => {
  it('returns only the registration status needed by the client', () => {
    expect(publicRegistrationOutcome({
      authenticated: false,
      emailConfirmationRequired: true,
      attributionFromCookie: false,
    })).toEqual({
      authenticated: false,
      emailConfirmationRequired: true,
      attributionFromCookie: false,
    });
  });

  it('logs outcome flags without user identifiers, referral values, or provider errors', () => {
    const summary = registrationLogSummary({
      hasUser: true,
      hasSession: false,
      authenticated: false,
      emailConfirmationRequired: true,
      attributionAttempted: true,
      attributionFromCookie: false,
    });

    expect(summary).toEqual({
      hasUser: true,
      hasSession: false,
      authenticated: false,
      emailConfirmationRequired: true,
      attributionAttempted: true,
      attributionSucceeded: false,
    });
    expect(Object.keys(summary)).not.toContain('userId');
    expect(Object.keys(summary)).not.toContain('referralCode');
    expect(Object.keys(summary)).not.toContain('error');
  });
});
