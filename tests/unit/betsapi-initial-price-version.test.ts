import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0218_betsapi_initial_live_price_version.sql'),
  'utf8',
);

describe('BetsAPI first live price version migration', () => {
  it('retains atomic publisher source recency and idempotency protections', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION nova.publish_odds_tick(');
    expect(migration).toContain('FOR UPDATE;');
    expect(migration).toContain('p_provider_timestamp <= v_sel.provider_timestamp');
    expect(migration).toContain('h.ingest_key = p_ingest_key');
    expect(migration).toContain('IF p_reject THEN');
  });

  it('only gives a positive initial version to an accepted BetsAPI quote', () => {
    expect(migration).toContain(
      "CASE WHEN p_provider = 'betsapi' AND v_sel.provider = 'betsapi' THEN 1 ELSE 0 END",
    );
    expect(migration).toContain('v_sel.odds_scaled IS DISTINCT FROM p_odds_scaled');
    expect(migration).toContain('greatest(');
    expect(migration).toContain('odds_version = v_new_version');
  });

  it('does not backfill old odds or touch bets or wallets', () => {
    expect(migration).not.toMatch(/UPDATE\s+nova\.(bets|wallets|bet_legs)\b/i);
    expect(migration).not.toMatch(/UPDATE\s+nova\.selections\s+SET\s+odds_version\s*=\s*1\b/i);
  });
});
