import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/workers/fivedollar-stats.worker.ts', 'utf8');
const entrypoint = readFileSync('src/workers/entrypoints/football-stats.worker.ts', 'utf8');

describe('FiveDollar dedicated football metadata process', () => {
  it('does not call bookmaker price APIs or settlement', () => {
    expect(source).not.toMatch(/\.fetchOdds\s*\(/);
    expect(source).not.toMatch(/\.fetchEventOdds\s*\(/);
    expect(source).not.toMatch(/\.syncOdds\s*\(/);
    expect(source).not.toMatch(/\.settle\s*\(/);
    expect(source).not.toMatch(/insert into nova\.(markets|selections|odds_history|bets|wallet)/i);
    expect(source).toContain("queue:'football-stats'");
    expect(source).toContain('handlers:[]');
    expect(entrypoint).toContain("import '../fivedollar-stats.worker'");
  });

  it('continues catalog ingestion after a live endpoint error and limits per-tick work', () => {
    expect(source).toContain("FIVEDOLLAR_LIVE_POLL_ERROR");
    expect(source).toContain("FIVEDOLLAR_CATALOG_POLL_ERROR");
    expect(source).toContain("FIVEDOLLAR_ALL_FEEDS_FAILED: live and catalog");
    expect(source).toContain("const MAX_LIVE_PER_CYCLE = 12;");
    expect(source).toContain("const MAX_CATALOG_PER_CYCLE = 32;");
    expect(source.indexOf('await pollLive(ctx.services.db)')).toBeLessThan(
      source.indexOf('await pollCatalog(ctx.services.db)'),
    );
    expect(source).toContain('try {\n        await pollCatalog(ctx.services.db);');
  });

  it('preserves bettable matches when ingesting external fixtures', () => {
    expect(source).toContain("row.match_provider === MATCH_SOURCE_FALLBACK");
    expect(source).toContain('not exists(select 1 from nova.markets');
    expect(source).toContain('linkCrossProviderMatch(');
    expect(source).toContain('MATCH_SOURCE_ODDS');
    expect(source).toContain("matched.status === 'conflict'");
  });

  it('stores stats and event identity from FiveDollar without invented scores', () => {
    expect(source).toContain('match.homeScore');
    expect(source).toContain('match.awayScore');
    expect(source).toContain('fiveDollarProviderEventId(');
    expect(source).toContain('nova.match_stats');
    expect(source).toContain('nova.match_events');
    expect(source).toContain('fixtureHasDetails');
  });
});
