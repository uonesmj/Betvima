import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { oddsFromDecimalString } from '@/domain/odds';

const sql = readFileSync('supabase/migrations/0207_fix_bonus_minimum_leg_odds_scaled.sql','utf8');
const engine = readFileSync('supabase/migrations/0176_bonus_engine.sql','utf8');
const placement = readFileSync('supabase/migrations/0178_bonus_bet_placement_odds_fix.sql','utf8');
const repository = readFileSync('src/server/adapters/postgres/bonuses.ts','utf8');

describe('100% deposit bonus financial contract', () => {
  it('represents each minimum leg price of 1.60 as exactly 16000 scaled units', () => {
    expect(oddsFromDecimalString('1.59')).toBe(15900n);
    expect(oddsFromDecimalString('1.60')).toBe(16000n);
    expect(oddsFromDecimalString('1.61')).toBe(16100n);
    expect(15900n < 16000n).toBe(true);
    expect(16000n < 16000n).toBe(false);
  });

  it('requires four selections, a full bonus-funded stake and an unexpired bonus', () => {
    expect(placement).toContain('jsonb_array_length(p_selections) <> 4');
    expect(placement).toContain('v_bonus.remaining_amount_minor <> p_stake_minor');
    expect(placement).toContain('v_bonus.expires_at <= v_now');
    expect(placement).toContain("p_funding_source = 'bonus'");
  });

  it('guards production function changes against SQL drift and a false 1.60 check', () => {
    expect(sql).toContain("v_bad text := 'v_sel.odds_scaled < 160 THEN'");
    expect(sql).toContain("v_good text := 'v_sel.odds_scaled < 16000 THEN'");
    expect(sql).toContain('BONUS_WAGERING_CONTRACT_DRIFT');
    expect(sql).toContain('BONUS_ODDS_GUARD_NOT_CORRECTED');
    expect(sql).toContain('EXECUTE v_after');
  });

  it('grants at most one independent bonus per successful deposit for exactly 24 hours', () => {
    expect(engine).toContain('unique (deposit_payment_transaction_id)');
    expect(engine).toContain("v_payment.status::text <> 'succeeded'");
    expect(engine).toContain('10000,');
    expect(engine).toContain("now() + interval '24 hours'");
    expect(engine).toContain("'deposit-bonus:' || v_payment.id::text");
    expect(engine).toContain('v_promotion.max_bonus_minor');
  });

  it('reads the active campaign independently of whether the user has bonus grants', () => {
    expect(repository).toContain("where slug = 'nova-100-deposit-bonus'");
    expect(repository).not.toContain('const promotionId = items.find');
  });
});
