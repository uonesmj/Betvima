import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'ops/hotfixes/20261013_odds_tick_early_duplicate_guard.sql',
  'utf8',
);
const worker = readFileSync('src/workers/odds.worker.ts', 'utf8');

describe('Odds history idempotency and expensive event-detail eligibility', () => {
  it('guards the exact production function before changing its SQL body', () => {
    expect(migration).toContain("md5(existing_body) <> '09ecb9d5869ea242abf213c47a6ab1b6'");
    expect(migration).toContain('ODDS_TICK_FUNCTION_DRIFTED_ABORT');
    expect(migration).toContain('ODDS_TICK_GUARD_OR_FRESHNESS_DRIFT_ABORT');
    expect(migration).toContain("definition := replace(definition, dedupe_guard, '');");
    expect(migration).toContain('definition := replace(definition, manual_guard, dedupe_guard || manual_guard);');
  });

  it('preserves source freshness and manual-review safety in the migration', () => {
    expect(migration).toContain("p_provider_timestamp >= now() - interval ''300 seconds''");
    expect(migration).toContain("p_provider_timestamp >= now() - interval ''45 seconds''");
    expect(migration).toContain("v_market.status::text = 'manual_review'");
    expect(migration).toContain("h.ingest_key = p_ingest_key");
    expect(migration).toContain("h.selection_id = p_selection_id");
  });

  it('does not schedule 404-prone stale fixtures for extended market discovery', () => {
    expect(worker).toContain("primary_market.key in ('h2h', 'spreads', 'totals')");
    expect(worker).toContain("source_quote.provider = m.provider");
    expect(worker).toContain("source_quote.odds_updated_at >= now() - interval '5 minutes'");
    expect(worker).toContain("source_quote.provider_timestamp >= now() - interval '5 minutes'");
    expect(worker).toContain("const normalSyncPending = pending.filter((row) => Boolean(row.provider_id))");
  });
});
