import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('single source of truth for sports data', () => {
  it('filters both the live and prematch odds JSON branches by the Odds API market AND selection', () => {
    const code = source('src/app/api/v1/matches/[id]/odds/route.ts');
    expect(code.match(/and mk\.provider = 'the_odds_api'/g)).toHaveLength(2);
    expect(code.match(/and sel\.provider = 'the_odds_api'/g)).toHaveLength(2);
    expect(code.match(/m\.provider = 'the_odds_api'/g)).toHaveLength(2);
  });

  it('rejects other sports sources from all background refresh/reconciliation paths', () => {
    const worker = source('src/workers/odds.worker.ts');
    // Non-Odds sources must never perform live discovery or settle results.
    expect(worker).toContain('provider.name === MATCH_SOURCE_ODDS && provider.configured');
    expect(worker.match(/provider\.name === MATCH_SOURCE_ODDS/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(source('src/workers/sports-provider-sync.ts'))
      .toContain('if (matchProvider !== MATCH_SOURCE_ODDS) return null');
  });

  it('hides retired Odds API health rows from the active provider panel', () => {
    for (const path of ['src/app/api/v1/admin/providers/route.ts', 'src/providers/null-providers.ts']) {
      expect(source(path)).toContain("where kind <> 'sports' or provider = 'disabled'");
    }
  });

  it('detaches The Odds API runtime from all active providers and gates ingestion', () => {
    const code = source('src/providers/null-providers.ts');
    expect(code).toContain('const sportsProviders: SportsDataProvider[] = [];');
    expect(code).not.toContain('new TheOddsApiSportsProvider()');
    expect(source('src/server/env.ts')).toContain('sportsProviderEnabled: false,');
    expect(source('src/app/api/v1/live/route.ts')).toContain("sportsSourceRevision: 'betsapi-bet365-only-v1'");
  });
});
