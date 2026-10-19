import { describe, expect, it } from 'vitest';
import { readReferralCookie } from '@/server/auth/referral-cookie';

describe('referral cookie attribution', () => {
  it('reads a first cookie and normalizes a referral code', () => {
    expect(readReferralCookie('nova_ref=novaABC123')).toBe('NOVAABC123');
  });

  it('preserves attribution when Supabase/session cookies precede nova_ref', () => {
    expect(readReferralCookie('sb-project-auth-token=abc; other=x; nova_ref=NOVA9261489E289C'))
      .toBe('NOVA9261489E289C');
  });

  it('recognizes extra spacing and encoded campaign codes', () => {
    expect(readReferralCookie('session=active;  nova_ref = nova-TEST-1%32 ; theme=dark'))
      .toBe('NOVA-TEST-12');
  });

  it('does not misread substring cookie names or invalid values', () => {
    expect(readReferralCookie('my_nova_ref=GOODCODE; nova_ref=%3Cscript%3E')).toBe('');
    expect(readReferralCookie('nova_ref=abc; session=1')).toBe('ABC');
    expect(readReferralCookie('nova_ref=bad%ZZ')).toBe('');
    expect(readReferralCookie(null)).toBe('');
  });

  it('selects an eligible value when a duplicate invalid cookie precedes it', () => {
    expect(readReferralCookie('nova_ref=%ZZ; nova_ref=VALIDCODE')).toBe('VALIDCODE');
  });
});
