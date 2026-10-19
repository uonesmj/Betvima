/**
 * Extract a server-issued referral cookie from a potentially multi-cookie
 * request header. Never use localStorage or a gift-code field as its source.
 */
export function readReferralCookie(header: string | null): string {
  if (!header) return '';

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1 || part.slice(0, separator).trim() !== 'nova_ref') {
      continue;
    }

    try {
      const code = decodeURIComponent(part.slice(separator + 1).trim()).trim().toUpperCase();
      if (/^[A-Z0-9_-]{3,64}$/.test(code)) return code;
    } catch {
      // Malformed cookie values cannot be accepted as referral identities.
    }
  }

  return '';
}
