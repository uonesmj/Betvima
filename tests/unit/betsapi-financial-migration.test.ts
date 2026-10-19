import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/0214_betsapi_wager_source_integrity.sql', 'utf8');

describe('BetsAPI financial migration source freshness', () => {
  it('extends the legacy live-source quote-age check rather than replacing it', () => {
    const placeBet = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION nova.place_bet('));
    const quoteGuard = placeBet.match(/IF v_sel\.odds_updated_at IS NULL[\s\S]*?RAISE EXCEPTION 'STALE_ODDS'/)?.[0];
    expect(quoteGuard).toBeDefined();
    expect(quoteGuard).toContain("v_sel.provider = 'betsapi'");
    expect(quoteGuard).toContain("(v_is_live OR v_sel.provider = '5dollarfootballapi')");
    expect(quoteGuard).toContain("v_sel.provider IN ('the_odds_api', '5dollarfootballapi')");
    expect(quoteGuard).toContain('v_sel.provider_timestamp IS NULL');
    expect(quoteGuard).toContain("v_sel.provider_timestamp > v_now + interval '15 seconds'");
  });

  it('keeps financial restrictions and opt-in price change checks intact', () => {
    expect(sql).toContain("nova.operation_enabled('BETTING')");
    expect(sql).toContain("nova.operation_enabled('LIVE_BETTING')");
    expect(sql).toContain("RAISE EXCEPTION 'AGE_NOT_VERIFIED'");
    expect(sql).toContain("RAISE EXCEPTION 'ODDS_CHANGED'");
    expect(sql).toContain('IF jsonb_array_length(v_changes) > 0 AND NOT p_accept_odds_change THEN');
  });

  it('preserves legacy source-owned market reopening in both prematch and live ticks', () => {
    const publish = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION nova.publish_odds_tick('));
    const expected = "p_provider IN ('the_odds_api', '5dollarfootballapi', 'betsapi')";
    // Each branch checks both market/provider identity and selection/provider identity.
    expect(publish.split(expected).length - 1).toBe(4);
    expect(publish).toContain('v_market.provider = p_provider');
    expect(publish).toContain('v_sel.provider = p_provider');
    expect(publish).toContain("p_provider_timestamp >= now() - interval '300 seconds'");
    expect(publish).toContain("p_provider_timestamp >= now() - interval '45 seconds'");
    expect(publish).toContain("nova.operation_enabled('LIVE_BETTING')");
    expect(publish).toContain("v_market.status::text = 'open'");
    expect(publish).toContain("v_sel.status::text = 'suspended'");
  });
});
