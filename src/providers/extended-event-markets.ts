/**
 * Event-detail requests are more expensive than grouped featured odds.
 * Only request configured non-featured markets observed from bookmakers
 * for this particular event. Never turn an unavailable market into a quote.
 */
export function selectExtendedEventMarkets(
  configured: string,
  discovered: readonly string[],
  featured: string,
  limit = 20,
): string[] {
  const available = new Set(discovered.map((key) => key.trim()).filter(Boolean));
  const featuredMarkets = new Set(featured.split(',').map((key) => key.trim()).filter(Boolean));
  const unique = new Set<string>();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.floor(limit))) : 20;
  for (const raw of configured.split(',')) {
    const key = raw.trim();
    if (!key || featuredMarkets.has(key) || !available.has(key)) continue;
    unique.add(key);
    if (unique.size >= safeLimit) break;
  }
  return [...unique];
}
