import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { currentCompletedCashbackWeek } from '../../src/workers/vip-cashback.worker';

const migration = readFileSync('supabase/migrations/0199_vip_cashback_engine.sql', 'utf8');
const worker = readFileSync('src/workers/vip-cashback.worker.ts', 'utf8');
const timer = readFileSync('ops/systemd/betvima-vip-cashback.timer', 'utf8');

describe('VIP cashback finance safeguards', () => {
  it('resolves the previous Monday-to-Sunday week in Tehran time', () => {
    expect(currentCompletedCashbackWeek(new Date('2026-10-19T06:00:00Z')))
      .toEqual({ start: '2026-10-12', localDay: 1, localHour: 9 });
    expect(currentCompletedCashbackWeek(new Date('2026-10-18T15:00:00Z')))
      .toEqual({ start: '2026-10-05', localDay: 7, localHour: 18 });
    expect(currentCompletedCashbackWeek(new Date('2026-10-19T03:00:00Z')))
      .toEqual({ start: '2026-10-12', localDay: 1, localHour: 6 });
  });

  it('uses precisely the five specified USD deposit bands', () => {
    for (const [minor, bps] of [
      [200000,300], [400000,500], [600000,600],
      [900000,800], [1500000,1100],
    ]) {
      expect(migration).toMatch(new RegExp('d.amount_minor >=\\s*' + minor + '\\s+then\\s+' + bps));
    }
    expect(migration).toContain('nova.apply_bps');
    expect(migration).toContain("currency = 'USD'");
  });

  it('uses verified ledger deposits and authoritative settled main-wallet losses', () => {
    expect(migration).toContain("p.status = 'succeeded'");
    expect(migration).toContain("wt.type = 'deposit'");
    expect(migration).toContain("wt.currency = 'USD'");
    expect(migration).toContain("b.funding_source = 'main'");
    expect(migration).toContain('bs.reversed_by is null');
    expect(migration).toContain("s.net_user_result_minor < 0");
  });

  it('has two independent disabled-by-default money gates', () => {
    expect(migration).toContain("('VIP_CASHBACK_PAYOUT', false");
    expect(migration).toContain('if not p_dry_run then');
    expect(migration).toContain('VIP_PAYOUTS_DISABLED');
    expect(worker).toContain("process.env.NOVA_VIP_CASHBACK_AUTOPAY === 'true'");
    expect(worker).toContain('p_dry_run: !live');
  });

  it('records wallet payments once and exposes reconciliation alerts', () => {
    expect(migration).toContain('unique(user_id, week_start)');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain("'vip_cashback'::nova.wallet_tx_type");
    expect(migration).toContain('nova.credit_wallet(');
    expect(migration).toContain('vip_cashback_reconcile');
    expect(migration).toContain('vip_cashback_discrepancies');
    expect(migration).toContain('revoke execute on function nova.vip_cashback_credit_user');
    expect(migration).toContain('vip_cb_payout_immutable');
    expect(migration).toContain('VIP_AMOUNT_REQUIRES_FINANCE_REVIEW');
  });

  it('uses a persistent Tehran-timezone Monday timer and no automatic installation', () => {
    expect(timer).toContain('OnCalendar=Mon *-*-* 09:00:00 Asia/Tehran');
    expect(timer).toContain('Persistent=true');
  });
});
