/** Accept only the configured public website as the origin of an admin mutation.
 *
 * The origin of a Next.js Request can be reconstructed as a private HTTP
 * proxy hop on production VPS. It must not be compared to request.url.origin:
 * use the server-controlled canonical site URL instead, with the explicitly
 * supported www alias. Never authorize arbitrary Origin from forwarded headers.
 */
export function isApprovedAdminOrigin(origin: string | null, siteUrl: string): boolean {
  if (!origin) return false;
  try {
    const canonical = new URL(siteUrl);
    const supplied = new URL(origin);
    if (supplied.origin !== origin || supplied.username || supplied.password
      || supplied.pathname !== '/' || supplied.search || supplied.hash
      || canonical.username || canonical.password) return false;
    if (supplied.origin === canonical.origin) return true;
    return canonical.protocol === 'https:' && canonical.hostname === 'betvima.com'
      && supplied.origin === 'https://www.betvima.com';
  } catch {
    return false;
  }
}
