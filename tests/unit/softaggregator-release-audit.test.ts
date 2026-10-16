import { describe, expect, it } from 'vitest';
import {
  assessCasinoReadiness, explicitCasinoCountryList, singlePilotIdConfigured,
  type CasinoAuditSnapshot,
} from '@/server/providers/softaggregator/release-audit';

function baseline(): CasinoAuditSnapshot {
  return {
    schemaReady: true,
    migrationsValid: true,
    walletCount: 69,
    journalCount: 630,
    walletDiscrepancies: 0,
    callbackReceipts: 0,
    supplierRounds: 0,
    playerBindings: 0,
    receiptLedgerDiscrepancies: 0,
    providerApiConfigured: true,
    callbackHmacConfigured: true,
    geoHmacConfigured: true,
    explicitCountryList: true,
    singlePlayerPilotConfigured: true,
    realMoneyFlagEnabled: false,
  };
}
describe('SoftAggregator read-only production readiness classifier', () => {
  it('never turns a clean schema into permission to accept public wagers', () => {
    const report = assessCasinoReadiness(baseline());
    expect(report.readOnly).toBe(true);
    expect(report.publicMoneyApproved).toBe(false);
    expect(report.status).toBe('blocked_external_verification');
    expect(report.checks.find(c => c.name === 'wallet_journal_integrity')?.status)
      .toBe('passed');
    expect(report.checks.find(c => c.name === 'authentic_supplier_origin_signed_callbacks')?.status)
      .toBe('needs_external_evidence');
    expect(report.financial.signedReceiptRows).toBe(0);
  });

  it('does not mistake locally stored receipts for verified supplier provenance', () => {
    const report = assessCasinoReadiness({
      ...baseline(), callbackReceipts: 10, supplierRounds: 4, playerBindings: 1,
    });
    expect(report.publicMoneyApproved).toBe(false);
    expect(report.checks.find(c => c.name === 'getPlayerHistory_vs_actual_round_ledger')?.status)
      .toBe('needs_external_evidence');
  });

  it('fails closed on schema, journal, receipt or migration drift', () => {
    for (const changes of [
      { schemaReady: false },
      { migrationsValid: false },
      { walletDiscrepancies: 1 },
      { receiptLedgerDiscrepancies: 1 },
      { walletCount: -1 },
      { journalCount: Number.NaN },
      { callbackReceipts: -1 },
    ]) {
      const report = assessCasinoReadiness({ ...baseline(), ...changes });
      expect(report.status).toBe('blocked_technical');
      expect(report.publicMoneyApproved).toBe(false);
      expect(report.checks.some(c => c.status === 'failed')).toBe(true);
    }
  });

  it('treats a preapproval cash feature flag as an unsafe configuration', () => {
    const report = assessCasinoReadiness({ ...baseline(), realMoneyFlagEnabled: true });
    expect(report.status).toBe('blocked_technical');
    expect(report.checks.find(c => c.name === 'cash_flag_remains_off_before_approval')?.status)
      .toBe('failed');
  });

  it('refuses wildcard, duplicate, ambiguous, lower-case country policies', () => {
    for (const list of [undefined, '', '*', 'DE,DE', 'de', 'DE,?', 'DE,IR,',
      'DE,,BR', 'DE;BR']) {
      expect(explicitCasinoCountryList(list)).toBe(false);
    }
    expect(explicitCasinoCountryList('DE,BR')).toBe(true);
    expect(explicitCasinoCountryList('CW')).toBe(true);
  });

  it('accepts only a proper pilot UUID without printing the ID', () => {
    expect(singlePilotIdConfigured('00000000-0000-4000-8000-000000000002'))
      .toBe(true);
    expect(singlePilotIdConfigured('*')).toBe(false);
    expect(singlePilotIdConfigured('user1')).toBe(false);
    expect(singlePilotIdConfigured(undefined)).toBe(false);
  });
});
