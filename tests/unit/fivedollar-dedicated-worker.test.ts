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
