import { describe, expect, it } from 'vitest';
import { assuranceLevelFromVerifiedToken, hasVerifiedTotp } from '@/server/auth/mfa-policy';

function token(aal: string): string {
  const data = Buffer.from(JSON.stringify({ sub: 'user-1', aal })).toString('base64url');
  return 'header.' + data + '.signature';
}

describe('MFA assurance policy', () => {
  it('is fail-closed for absent, malformed, or AAL1 sessions', () => {
    expect(assuranceLevelFromVerifiedToken(null)).toBe('aal1');
    expect(assuranceLevelFromVerifiedToken('garbage')).toBe('aal1');
    expect(assuranceLevelFromVerifiedToken(token('aal1'))).toBe('aal1');
    expect(assuranceLevelFromVerifiedToken(token('other'))).toBe('aal1');
  });
  it('recognizes AAL2 from a token only after its server-side getUser validation', () => {
    expect(assuranceLevelFromVerifiedToken(token('aal2'))).toBe('aal2');
  });
  it('does not confuse unverified pending enrollment with an enabled factor', () => {
    expect(hasVerifiedTotp(undefined)).toBe(false);
    expect(hasVerifiedTotp([])).toBe(false);
    expect(hasVerifiedTotp([{ factor_type: 'totp', status: 'unverified' }])).toBe(false);
    expect(hasVerifiedTotp([{ factor_type: 'phone', status: 'verified' }])).toBe(false);
    expect(hasVerifiedTotp([{ factor_type: 'totp', status: 'verified' }])).toBe(true);
  });
});
