import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve('scripts/casino/edge-financial-receipts-readonly.sql'), 'utf8');
const wallet = readFileSync(resolve('src/server/providers/softaggregator/wallet.ts'), 'utf8');
const fiat = readFileSync(resolve('src/server/providers/softaggregator/fiat-wallet.ts'), 'utf8');
const readiness = readFileSync(resolve('src/server/providers/softaggregator/financial-readiness.ts'), 'utf8');

describe('Casino Edge financial migration: historical receipt audit, read-only', () => {
  it('only executes one read-only aggregate SELECT, never DDL or DML', () => {
    const withoutComments = sql.replace(/^\s*--.*$/gm, '').trim();
    expect(withoutComments).toMatch(/^WITH\s+receipts\s+AS\s*\(/i);
    expect(withoutComments).toMatch(/AS historical_receipts_pass\s+FROM receipts/i);
    expect(withoutComments).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|TRUNCATE\s+|DROP\s+|ALTER\s+|CREATE\s+|GRANT\s+|REVOKE\s+)\b/i);
    expect(withoutComments.split(';').filter(Boolean)).toHaveLength(1);
    expect(withoutComments).not.toMatch(/\bpg_sleep\s*\(/i);
  });

  it('checks that success, rejection, refunds and credited wins stay accounted for', () => {
    const mustCheck = [
      'successful_without_ledger_id',
      'rejected_with_ledger_id',
      'successful_missing_ledger_row',
      'successful_ledger_currency_or_amount_mismatch',
      'successful_rollback_without_original',
      'successful_receipt_without_round_fx',
      'successful_round_currency_mismatch',
      'successful_binding_currency_mismatch',
      'double_refund_targets',
      'double_win_reversal_targets',
      'duplicated_success_ledger_reference',
      'historical_receipts_pass',
    ];
    for (const key of mustCheck) expect(sql).toContain(key);
    expect(sql).toContain('softaggregator_player_wallet_bindings');
    expect(sql).toContain('softaggregator_round_fx');
    expect(sql).toContain('wallet_transactions');
    expect(sql).toContain('softaggregator_callback_receipts');
  });

  it('preserves authoritative transaction, receipt and wallet binding prerequisites', () => {
    expect(wallet).toContain('casinoFinancialSchemaReady(db)');
    expect(wallet).toContain('readCasinoPlayerWallet(db, userId)');
    expect(wallet).toContain('pg_advisory_xact_lock');
    expect(wallet).toContain('post_wallet_entry');
    expect(wallet).toContain('softaggregator_callback_receipts');
    expect(wallet).toContain('original_debit_call_id');
    expect(wallet).toContain('original_credit_call_id');
    expect(fiat).toContain('softaggregator_round_fx');
    expect(fiat).toContain('exactCasinoRefund');
    expect(fiat).toContain('post_wallet_entry');
    expect(readiness).toContain('sa_receipt_posting_coherent');
    expect(readiness).toContain('sa_receipt_integrity_on_insert');
  });

  it('audits aggregates without revealing per-user receipts or balances', () => {
    expect(sql).toContain('COUNT(*)');
    expect(sql).not.toMatch(/\bSELECT\s+(?:r\.)?call_id\b/i);
    expect(sql).not.toMatch(/\bSELECT\s+(?:r\.)?user_id\b/i);
    expect(sql).not.toMatch(/\bSELECT\s+(?:r\.)?balance_minor\b/i);
    expect(sql).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(sql).not.toContain('SOFTAGGREGATOR_SALT_KEY');
  });
});
