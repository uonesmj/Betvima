import { createHash } from 'node:crypto';

/**
 * Stable team key for provider fixtures. BetsAPI IDs take precedence because
 * many non-Latin club names become an empty slug under the old ASCII-only
 * conversion and distinct clubs were silently merged.
 */
export function sportsTeamSlug(
  name: string, provider: string, providerTeamId: string | null | undefined,
): string {
  const fallback = name.normalize('NFKC').trim().toLocaleLowerCase('en');
  const legacy = fallback.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Reuse historical canonical identities for legacy providers.
  if (provider !== 'betsapi' && legacy) return legacy;

  const namespace = provider.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'provider';
  const id = (providerTeamId ?? '').trim();
  if (/^\d{1,16}$/.test(id)) return namespace + '-team-' + id;

  // Missing provider team IDs are common in smaller leagues. Hash the full
  // Unicode name rather than losing the characters and colliding on ''.
  const digest = createHash('sha256').update(fallback).digest('hex').slice(0, 24);
  return namespace + '-team-' + digest;
}
