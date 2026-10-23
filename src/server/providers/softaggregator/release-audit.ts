import { casinoCountryPermitted, casinoCountryRestrictedByProvider } from './jurisdiction';

/**
 * Read-only production casino readiness classification.
 *
 * A database schema or locally generated HMAC fixture can never prove
 * supplier-origin money movement, licensing, Cloudflare deployment, or
 * provider-to-ledger reconciliation. Never issue an automatic go-live approval.
 */
export type CasinoAuditSnapshot = Readonly<{
  schemaReady: boolean;
  migrationsValid: boolean;
  walletCount: number;
  journalCount: number;
  walletDiscrepancies: number;
  callbackReceipts: number;
  supplierRounds: number;
  playerBindings: number;
  receiptLedgerDiscrepancies: number;
  verifiedIdentityCount: number;
  pilotIdentityVerified: boolean;
  providerApiConfigured: boolean;
  callbackHmacConfigured: boolean;
  geoHmacConfigured: boolean;
  explicitCountryList: boolean;
  singlePlayerPilotConfigured: boolean;
  realMoneyFlagEnabled: boolean;
}>;

export type CasinoAuditCheck = Readonly<{
  name: string;
  status: 'passed' | 'failed' | 'needs_external_evidence';
}>;

function countOk(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function assessCasinoReadiness(snapshot: CasinoAuditSnapshot) {
  const checks: CasinoAuditCheck[] = [];
  const check = (name: string, ok: boolean) => checks.push({
    name, status: ok ? 'passed' : 'failed',
  });
  check('financial_schema', snapshot.schemaReady);
  check('canonical_migrations_0208_0212', snapshot.migrationsValid);
  check('wallet_journal_integrity',
    countOk(snapshot.walletCount) && countOk(snapshot.journalCount) &&
    snapshot.walletDiscrepancies === 0);
  check('verified_kyc_count_valid', countOk(snapshot.verifiedIdentityCount));
  check('receipt_ledger_integrity',
    countOk(snapshot.callbackReceipts) && countOk(snapshot.supplierRounds) &&
    countOk(snapshot.playerBindings) &&
    snapshot.receiptLedgerDiscrepancies === 0);
  check('provider_api_credentials_configured', snapshot.providerApiConfigured);
  check('callback_signing_key_configured', snapshot.callbackHmacConfigured);
  check('geo_attestation_key_configured', snapshot.geoHmacConfigured);
  check('explicit_country_list_configured', snapshot.explicitCountryList);
  check('single_player_pilot_configured', snapshot.singlePlayerPilotConfigured);
  check('pilot_age_and_kyc_verified', snapshot.pilotIdentityVerified);
  check('cash_flag_remains_off_before_approval', !snapshot.realMoneyFlagEnabled);

  for (const name of [
    'authentic_supplier_origin_signed_callbacks',
    'getPlayerHistory_vs_actual_round_ledger',
    'cloudflare_edge_geo_deployment_and_origin_firewall',
    'operator_authorization_and_permitted_territories',
    'responsible_gambling_live_checks',
    'provider_credentials_rotated',
    'authorized_pilot_and_final_public_release',
  ]) {
    checks.push({ name, status: 'needs_external_evidence' });
  }

  return {
    readOnly: true as const,
    publicMoneyApproved: false as const,
    status: checks.some((c) => c.status === 'failed')
      ? 'blocked_technical' as const : 'blocked_external_verification' as const,
    financial: {
      wallets: snapshot.walletCount,
      ledgerEntries: snapshot.journalCount,
      walletDiscrepancies: snapshot.walletDiscrepancies,
      signedReceiptRows: snapshot.callbackReceipts,
      providerRoundRows: snapshot.supplierRounds,
      playerBindingRows: snapshot.playerBindings,
      receiptLedgerDiscrepancies: snapshot.receiptLedgerDiscrepancies,
      verifiedIdentityCount: snapshot.verifiedIdentityCount,
    },
    checks,
  };
}

export function explicitCasinoCountryList(value: string | undefined): boolean {
  if (!value || value.length > 255) return false;
  const values = value.split(',').map(v => v.trim());
  return values.length > 0 && values.length <= 30 &&
    values.every(v => /^[A-Z]{2}$/.test(v) && !casinoCountryRestrictedByProvider(v) &&
      casinoCountryPermitted(v, value)) &&
    new Set(values).size === values.length;
}

export function singlePilotIdConfigured(value: string | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    (value ?? '').trim(),
  );
}
