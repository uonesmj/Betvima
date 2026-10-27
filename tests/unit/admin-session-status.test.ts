import { describe, expect, it } from 'vitest';
import { sessionTransportFailure, verifiedSessionEnvelope } from '@/lib/auth/session-status';

describe('admin session transport status must fail closed', () => {
  it('does not declare Supabase unconfigured for timeouts or failed requests', () => {
    expect(sessionTransportFailure()).toEqual({
      authenticated: false, authUnavailable: false, sessionCheckFailed: true, user: null,
    });
    expect(sessionTransportFailure()).not.toHaveProperty('isAdmin');
  });

  it('preserves server-confirmed missing auth configuration only with a valid response', () => {
    expect(verifiedSessionEnvelope(true, {
      ok: true, data: { authenticated: false, authUnavailable: true, user: null },
    })).toEqual({ authenticated: false, authUnavailable: true, user: null });
  });

  it('accepts a verified administrator session without creating any new authority', () => {
    const user = { id: 'test', isAdmin: true, mfaEnrolled: true, mfaLevel: 'aal2' };
    expect(verifiedSessionEnvelope(true, {
      ok: true, data: { authenticated: true, authUnavailable: false, user },
    })).toEqual({ authenticated: true, authUnavailable: false, user });
  });

  it('rejects non-200 replies, malformed envelopes and inconsistent identity', () => {
    const bad = [
      [false, { ok: true, data: { authenticated: true, authUnavailable: false, user: { isAdmin: true } } }],
      [true, { ok: false, data: { authenticated: true, authUnavailable: false, user: { isAdmin: true } } }],
      [true, { ok: true, data: null }],
      [true, { ok: true, data: { authenticated: true, authUnavailable: false, user: null } }],
      [true, { ok: true, data: { authenticated: false, authUnavailable: false, user: { isAdmin: true } } }],
      [true, { ok: true, data: { authenticated: true, authUnavailable: true, user: { isAdmin: true } } }],
      [true, { ok: true, data: { authenticated: true, authUnavailable: false } }],
      [true, null],
    ] as const;
    for (const [httpOk, payload] of bad) {
      expect(() => verifiedSessionEnvelope(httpOk, payload)).toThrow();
    }
  });
});
