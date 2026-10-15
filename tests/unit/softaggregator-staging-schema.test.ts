import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const pending = 'docs/pending-financial-migrations/';

describe('SoftAggregator pending financial schema release guard', () => {
  const receipts = readFileSync(pending + '0208_softaggregator_callback_receipts.sql', 'utf8');
  const fx = readFileSync(pending + '0209_softaggregator_fx_rounds.sql', 'utf8');

  it('keeps financial migration changes separate from production', () => {
    expect(receipts).toContain('create table if not exists nova.softaggregator_callback_receipts');
    expect(fx).toContain('create table if not exists nova.softaggregator_round_fx');
    expect(fx).toContain('rate_irt_per_usd');
    expect(fx).toContain('original_debit_call_id');
  });

  it('uses properly paired PostgreSQL dollar delimiters for audit triggers', () => {
    const delimiters = fx.match(/\$casino_audit\$/g) ?? [];
    expect(delimiters).toHaveLength(2);
    expect(fx).toContain('returns trigger language plpgsql as $casino_audit$');
    expect(fx).toContain('end;\n$casino_audit$;');
    expect(fx).not.toMatch(/language plpgsql as \$\s*\n/);
  });

  it('rejects rewrites of currency snapshots and callback receipts', () => {
    expect(fx).toContain('create trigger sa_fx_round_immutable');
    expect(fx).toContain('create trigger sa_receipt_immutable');
    expect(fx).toContain('create unique index if not exists sa_unique_reversed_debit');
    expect(fx).toContain('foreign key (original_debit_call_id)');
    expect(fx).toContain('sa_successful_rollback_has_original');
  });
});
