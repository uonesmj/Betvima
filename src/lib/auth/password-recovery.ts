/**
 * Never treat an ordinary signed-in browser session as permission to reset a
 * password. Recovery requires a proof delivered by the email link.
 */
export type PasswordRecoveryGrant =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'token-hash'; tokenHash: string }
  | { kind: 'invalid' };

export function parsePasswordRecoveryGrant(href: string): PasswordRecoveryGrant {
  const url = new URL(href);
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));

  // Supabase can return errors in either the URL query or fragment.
  if (query.has('error') || query.has('error_code') ||
      fragment.has('error') || fragment.has('error_code')) {
    return { kind: 'invalid' };
  }

  const tokenHash = query.get('token_hash');
  if (tokenHash) {
    return query.get('type') === 'recovery'
      ? { kind: 'token-hash', tokenHash }
      : { kind: 'invalid' };
  }

  // OAuth/PKCE-style links carry a one-time code in the query.
  const code = query.get('code');
  if (code) {
    return { kind: 'code', code };
  }

  // Implicit recovery links deliver tokens in the URL fragment.
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken || refreshToken) {
    return accessToken && refreshToken && fragment.get('type') === 'recovery'
      ? { kind: 'tokens', accessToken, refreshToken }
      : { kind: 'invalid' };
  }

  return { kind: 'invalid' };
}

/** Remove one-use credentials from browser history without losing portal choice. */
export function clearedPasswordRecoveryPath(href: string): string {
  const url = new URL(href);
  return url.pathname +
    (url.searchParams.get('from') === 'affiliate' ? '?from=affiliate' : '');
}
