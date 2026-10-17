/** Never trust unverified JWT content: callers MUST first validate this
 * exact access token with Supabase Auth getUser(token). This helper only
 * extracts the signed session's AAL after that authentication succeeds.
 */
export function assuranceLevelFromVerifiedToken(token: string | null): 'aal1' | 'aal2' {
  if (!token) return 'aal1';
  try {
    const payload = token.split('.')[1];
    if (!payload) return 'aal1';
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { aal?: unknown };
    return decoded.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

/** Enrollment becomes effective only after Supabase marks the factor verified. */
export function hasVerifiedTotp(
  factors: ReadonlyArray<{ factor_type?: string; status?: string }> | undefined,
): boolean {
  return Boolean(factors?.some((factor) =>
    factor.factor_type === 'totp' && factor.status === 'verified'));
}
