import { describe, expect, it } from 'vitest';
import {
  clearedPasswordRecoveryPath,
  parsePasswordRecoveryGrant,
  passwordRecoveryRequestPath,
} from '@/lib/auth/password-recovery';

describe('Supabase password recovery redirect', () => {
  it('restarts expired recovery from the proper email request form', () => {
    expect(passwordRecoveryRequestPath(false)).toBe('/auth/login?forgot=1');
    expect(passwordRecoveryRequestPath(true)).toBe('/affiliate/login?forgot=1');
    expect(passwordRecoveryRequestPath(false)).not.toContain('/reset-password');
  });

  it('accepts an explicit recovery session from an email link', () => {
    expect(parsePasswordRecoveryGrant(
      'https://betvima.com/auth/reset-password?from=affiliate#access_token=one&refresh_token=two&type=recovery',
    )).toEqual({
      kind: 'tokens',
      accessToken: 'one',
      refreshToken: 'two',
    });
  });

  it('accepts one-time PKCE codes and recovery token hashes', () => {
    expect(parsePasswordRecoveryGrant(
      'https://betvima.com/auth/reset-password?from=affiliate&code=abc',
    )).toEqual({ kind: 'code', code: 'abc' });
    expect(parsePasswordRecoveryGrant(
      'https://betvima.com/auth/reset-password?token_hash=xyz&type=recovery',
    )).toEqual({ kind: 'token-hash', tokenHash: 'xyz' });
  });

  it('never allows a previously signed-in browser session without a recovery link', () => {
    expect(parsePasswordRecoveryGrant(
      'https://betvima.com/auth/reset-password?from=affiliate',
    )).toEqual({ kind: 'invalid' });
    expect(parsePasswordRecoveryGrant(
      'https://betvima.com/auth/reset-password',
    )).toEqual({ kind: 'invalid' });
  });

  it('rejects error redirects, partial tokens and non-recovery grants', () => {
    const base = 'https://betvima.com/auth/reset-password';
    expect(parsePasswordRecoveryGrant(
      base + '#access_token=a&refresh_token=b&type=signup',
    )).toEqual({ kind: 'invalid' });
    expect(parsePasswordRecoveryGrant(base + '#access_token=a&type=recovery'))
      .toEqual({ kind: 'invalid' });
    expect(parsePasswordRecoveryGrant(base + '?token_hash=xyz&type=signup'))
      .toEqual({ kind: 'invalid' });
    expect(parsePasswordRecoveryGrant(base + '?error=access_denied'))
      .toEqual({ kind: 'invalid' });
    expect(parsePasswordRecoveryGrant(base + '#error_code=otp_expired'))
      .toEqual({ kind: 'invalid' });
  });

  it('removes credentials and retains only the affiliate return route', () => {
    expect(clearedPasswordRecoveryPath(
      'https://betvima.com/auth/reset-password?from=affiliate&code=SECRET#access_token=JWT',
    )).toBe('/auth/reset-password?from=affiliate');
    expect(clearedPasswordRecoveryPath(
      'https://betvima.com/auth/reset-password?code=SECRET',
    )).toBe('/auth/reset-password');
  });
});
