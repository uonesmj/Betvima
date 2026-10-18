/**
 * Read-only Bet365 fixture logo enrichment. Reuses the VERIFIED team/league
 * artwork previously collected by BetVima; never reintroduces historical
 * bookmaker fixture IDs, odds, or selection state.
 */
import { getDb } from '@/server/db';
import { cacheKeyForName } from '@/server/services/logo-sources/normalize';
import { getLocalLeagueLogo } from '@/lib/team-logo';
import type { MatchViewPayload } from '@/server/queries/public';

type LogoRow = { entity_type: 'team' | 'league'; name_key: string; logo_url: string };
type HistoricRow = { entity_type: 'team' | 'league'; name: string; logo_url: string };
const saved = new Map<string, { until: number; logo: string | null }>();
const CACHE_MS = 15 * 60_000;
const validLogo = (url: string): boolean => /^(?:https:\/\/[^\s]+|\/[a-zA-Z0-9/_.,-]+)$/.test(url);
const norm = (value: string): string => value.trim().toLocaleLowerCase('en-US');

/**
 * Match logos by canonical name AND sport, never by Bet365 ID:
 * Bet365 upcoming/inplay IDs are unrelated to Events API and old Odds API ids.
 */
export async function attachBet365Logos(matches: MatchViewPayload[], sport: string): Promise<MatchViewPayload[]> {
  if (!matches.length) return matches;
  const teamNames = [...new Set(matches.flatMap(m => m.participants.map(p => p.name)).filter(Boolean))].slice(0, 400);
  const leagueNames = [...new Set(matches.map(m => m.leagueName).filter((n): n is string => Boolean(n)))].slice(0, 250);
  const requests = [
    ...teamNames.map(name => ({ entity: 'team' as const, name })),
    ...leagueNames.map(name => ({ entity: 'league' as const, name })),
  ];
  const now = Date.now();
  const fresh = requests.filter(r => (saved.get(`${sport}:${r.entity}:${norm(r.name)}`)?.until ?? 0) <= now);
  if (fresh.length) {
    const byName = new Map<string, string>();
    try {
      const database = getDb();
      const keys = [...new Set(fresh.map(x => cacheKeyForName(x.name)))];
      const cache = await database.query<LogoRow>(
        `select entity_type, name_key, logo_url from nova.logo_cache
          where sport = $1 and name_key = any($2::text[]) and logo_url is not null
            and expires_at > now() limit 800`, [sport, keys],
      );
      for (const hit of cache) if (validLogo(hit.logo_url))
        byName.set(`${hit.entity_type}:${hit.name_key}`, hit.logo_url);

      // Original catalog has some real, verified artwork not yet copied into
      // nova.logo_cache. Match by exact normalized name, with sport isolation.
      const names = [...new Set(fresh.map(x => norm(x.name)))];
      const historic = await database.query<HistoricRow>(
        `select 'team'::text as entity_type, t.name as name, t.logo as logo_url
           from nova.teams t join nova.sports s on s.id = t.sport_id
          where s.slug = $1 and lower(t.name) = any($2::text[]) and t.logo is not null
         union all
         select 'league'::text as entity_type, l.name as name, l.logo as logo_url
           from nova.leagues l join nova.sports s on s.id = l.sport_id
          where s.slug = $1 and lower(l.name) = any($2::text[]) and l.logo is not null
          limit 700`, [sport, names],
      );
      for (const hit of historic) {
        if (!validLogo(hit.logo_url)) continue;
        const key = `${hit.entity_type}:${cacheKeyForName(hit.name)}`;
        if (!byName.has(key)) byName.set(key, hit.logo_url);
      }
    } catch {
      // Fail soft: public sportsbook never depends on logo database uptime.
    }
    for (const req of fresh) {
      const cacheId = `${sport}:${req.entity}:${norm(req.name)}`;
      saved.set(cacheId, {
        until: now + CACHE_MS,
        logo: byName.get(`${req.entity}:${cacheKeyForName(req.name)}`) ?? null,
      });
    }
    if (saved.size > 5000) for (const [k,v] of saved)
      if (v.until <= now) saved.delete(k);
  }
  const get = (entity: 'team' | 'league', name: string) =>
    saved.get(`${sport}:${entity}:${norm(name)}`)?.logo ?? null;
  return matches.map(match => ({
    ...match,
    leagueLogoUrl: match.leagueLogoUrl ?? get('league', match.leagueName ?? '') ??
      getLocalLeagueLogo(match.leagueName),
    participants: match.participants.map(p => ({
      ...p, logoUrl: get('team', p.name) ?? p.logoUrl,
    })),
  }));
}
