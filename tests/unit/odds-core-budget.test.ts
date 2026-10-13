import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const provider = readFileSync('src/providers/the-odds-api.ts', 'utf8');
const core = provider.slice(provider.indexOf('  async fetchOdds('), provider.indexOf('  async fetchEventOdds('));

describe('Core bookmaker price-poll timeout isolation', () => {
  it('uses a strict rolling wall budget between grouped sport calls', () => {
    expect(core).toContain('const coreBudgetMs = 45_000;');
    expect(core).toContain('Date.now() - coreStartedAt >= coreBudgetMs');
    expect(core).toContain('ODDS_CORE_REQUEST_BUDGET_EXHAUSTED');
    expect(core).toContain('ODDS_PROVIDER_CORE_BATCH_SUMMARY');
  });
  it('isolates a failing league while preserving successful bookmakers', () => {
    expect(core).toContain('ODDS_PROVIDER_SPORT_BATCH_FAILED');
    expect(core).toContain('continue;');
    expect(core).toContain('successfulRequests += 1');
    expect(core).toContain('failedRequests += 1');
    expect(core).toContain('return providerResult(true, [...bundles.values()]);');
    expect(core).toContain('if (successfulRequests === 0 && failedRequests > 0)');
  });
  it('preserves usage quota protection and bounded 429 retries', () => {
    expect(core).toContain('if (message.includes("OUT_OF_USAGE_CREDITS")) throw error;');
    expect(core).toMatch(/"core",\s*1, \/\/ 429/);
    expect(provider).toContain('const retryLimit = maxRetriesOverride ?? MAX_FREQ_RETRIES');
  });
  it('never replaces upstream timestamps, prices or match identities', () => {
    expect(core).toContain('market.last_update ||');
    expect(core).toContain('bundle');
    expect(core).toContain('providerId(sportKey, event.id)');
    expect(core).not.toContain('status = "open" // override');
  });
});
