import { describe, expect, it } from 'vitest';
import { effectiveSelectionStatus } from '@/lib/live-odds-availability';
import { primaryBettingMarket } from '@/lib/primary-betting-market';

const now = Date.parse('2026-10-13T00:00:00Z');
const selection = {
  status: 'open',
  oddsUpdatedAt: new Date(now - 3_000).toISOString(),
  providerTimestamp: new Date(now - 10_000).toISOString(),
  provider: 'the_odds_api',
};

describe('read-only live odds freshness', () => {
  it('shows a fresh live bookmaker quote as open', () => {
    expect(effectiveSelectionStatus(selection, 'live', true, now)).toBe('open');
  });

  it('never makes a source-stale quote clickable just because the ingestion time was refreshed', () => {
    expect(effectiveSelectionStatus({
      ...selection,
      providerTimestamp: new Date(now - 90_000).toISOString(),
    }, 'in_play', false, now)).toBe('suspended');
  });

  it('rejects expired ingest timestamps and future source timestamps', () => {
    expect(effectiveSelectionStatus({
      ...selection,
      oddsUpdatedAt: new Date(now - 60_000).toISOString(),
    }, 'live', true, now)).toBe('suspended');
    expect(effectiveSelectionStatus({
      ...selection,
      providerTimestamp: new Date(now + 60_000).toISOString(),
    }, 'live', true, now)).toBe('suspended');
  });

  it('never overrides a provider suspension or a manual-review state', () => {
    expect(effectiveSelectionStatus({ ...selection, status: 'suspended' }, 'live', true, now)).toBe('suspended');
    expect(effectiveSelectionStatus({ ...selection, status: 'closed' }, 'live', true, now)).toBe('closed');
  });

  it('keeps the longer prematch window and skips live-only source policy before kickoff', () => {
    expect(effectiveSelectionStatus({
      ...selection,
      oddsUpdatedAt: new Date(now - 120_000).toISOString(),
      providerTimestamp: null,
    }, 'scheduled', false, now)).toBe('open');
  });
});

describe('primary market selection', () => {
  const market = (key: string, statuses: string[], status = 'open') => ({
    key,
    status,
    selections: statuses.map((selectionStatus) => ({ status: selectionStatus })),
  });

  it('chooses open totals instead of an unbookable 1X2 market', () => {
    const matches = [market('h2h', ['suspended', 'suspended', 'suspended']),
      market('totals', ['open', 'open']), market('spreads', ['open', 'open'])];
    expect(primaryBettingMarket(matches, true)?.key).toBe('totals');
  });

  it('prefers live 1X2 when both sides are available', () => {
    const matches = [market('totals', ['open', 'open']), market('h2h', ['open', 'open', 'open'])];
    expect(primaryBettingMarket(matches, true)?.key).toBe('h2h');
  });

  it('prefers a complete open market over a market with just one open outcome', () => {
    const matches = [market('h2h', ['open', 'suspended', 'suspended']),
      market('btts', ['open', 'open'])];
    expect(primaryBettingMarket(matches, true)?.key).toBe('btts');
  });

  it('never considers a suspended market with open selections bettable', () => {
    const matches = [market('h2h', ['open', 'open'], 'suspended'),
      market('totals', ['open', 'open'])];
    expect(primaryBettingMarket(matches, true)?.key).toBe('totals');
  });

  it('preserves a paused placeholder when nothing is available', () => {
    expect(primaryBettingMarket([market('h2h', ['suspended'])], true)?.key).toBe('h2h');
  });
});
