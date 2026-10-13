import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/providers/the-odds-api.ts', 'utf8');
const core = source.slice(source.indexOf('  async fetchOdds('), source.indexOf('  async fetchEventOdds('));
const extended = source.slice(source.indexOf('  async fetchEventOdds('), source.indexOf('  async fetch', source.indexOf('  async fetchEventOdds(') + 20));

describe('extended bookmaker odds worker prevents core-quote starvation', () => {
  it('limits expensive optional event requests to a short wall-time budget', () => {
    expect(extended).toContain('const extendedBudgetMs = 35_000');
    expect(extended).toContain('Date.now() - startedAt >= extendedBudgetMs');
    expect(extended).toContain('ODDS_EXTENDED_BUDGET_EXHAUSTED');
    expect(extended).toContain('ODDS_EXTENDED_BATCH_SUMMARY');
  });

  it('uses zero 429 retries for optional discovery and detail without changing core retry policy', () => {
    expect(source.slice(source.indexOf('async function discoverEventMarkets'), source.indexOf('function outcomeIdentity'))).toContain('0, // No exponential 429 retries');
    expect(extended).toContain('0, // Optional requests must never back off');
    expect(core).toContain('1, // 429: one bounded retry');
    expect(extended).toContain('ODDS_EXTENDED_RATE_LIMIT_STOP');
  });

  it('preserves valid returned extended quotes when an independent event fails', () => {
    expect(extended).toContain('ODDS_EXTENDED_EVENT_FETCH_FAILED');
    expect(extended).toContain('continue;');
    expect(extended).toContain('return providerResult(true, results)');
    expect(extended).toContain('if (message.includes("OUT_OF_USAGE_CREDITS")) throw error');
  });

  it('never invents bookmaker price timestamps from the local fetch clock', () => {
    expect(source).not.toMatch(/market\.last_update\s*\|\|\s*bookmaker\.last_update\s*\|\|\s*new Date\(\)\.toISOString\(\)/);
    expect(source.match(/if \(!sourceUpdatedAt \|\| !Number\.isFinite\(Date\.parse\(sourceUpdatedAt\)\)\) continue;/g)).toHaveLength(2);
  });
});
