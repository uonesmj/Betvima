'use strict';
// Stage8B isolated signed-transport capture.
// Reuse the existing VPS Ed25519 caller without opening, exporting or changing keys.
// Only redirect the exact stage7 TEST endpoint to the staging-only stage8B endpoint.
// We never intercept supplier URLs, production callbacks, actual casino traffic, or wallets.
const from = 'https://mqygiufkubxxxjodsycu.supabase.co/functions/v1/betvima-eu-casino-stage7-outbound';
const to = 'https://qrirgzvxpjhhwvyazvpn.supabase.co/functions/v1/betvima-eu-casino-stage8b-real-finance';
const original = globalThis.fetch;
if (typeof original !== 'function') {
  process.stdout.write('STAGE8B_ERROR=NODE_FETCH_UNAVAILABLE\n');
} else {
  globalThis.fetch = async (input, options) => {
    const url = typeof input === 'string' ? input : input?.url?.toString() ?? input?.toString() ?? '';
    if (url !== from) return original(input, options);
    let result;
    const t0 = performance.now();
    if (typeof input === 'string' || input instanceof URL) {
      result = await original(to, options);
    } else {
      const redirected = new Request(to, input);
      result = await original(redirected, options);
    }
    const callerMs = Math.round((performance.now()-t0)*10)/10;
    let data;
    try { data = await result.clone().json(); } catch { data = null; }
    const pass = result.status === 200
      && data?.ok === true
      && data?.mode === 'STAGE8B_REAL_EDGE_TO_BRANCH_WALLET_RPC'
      && data?.branch_ref === 'qrirgzvxpjhhwvyazvpn'
      && data?.staging_financial_rpc_executed === true
      && data?.production_financial_operations_enabled === false
      && data?.production_project_used === false
      && data?.provider_contacted === false
      && data?.synthetic_balance_after_minor === 1000
      && data?.ledger_rows_for_round === 4
      && data?.receipt_rows_for_round === 4;
    if (pass) {
      process.stdout.write('STAGE8B_EDGE_RPC_REAL_FINANCE=PASS'
        +' E2E_MS='+callerMs
        +' EDGE_TO_BRANCH_RPC_MS='+data.rpc_e2e_ms
        +' DB_FINANCIAL_MS='+data.db_total_ms
        +' DB_DEBIT_MS='+data.db_phases_ms?.d
        +' DB_CREDIT_MS='+data.db_phases_ms?.c
        +' DB_REFUND_MS='+data.db_phases_ms?.f
        +' DB_REVERSE_MS='+data.db_phases_ms?.r
        +' IDEMPOTENT_MOVEMENTS='+data.idempotent_movements+'\n');
    } else if (result.status === 401) {
      process.stdout.write('STAGE8B_NEGATIVE_AUTH_REJECTED=PASS\n');
    } else {
      process.stdout.write('STAGE8B_EDGE_RPC_REAL_FINANCE=FAIL HTTP_STATUS='+result.status
        +' REASON='+String(data?.error??'INVALID_RESPONSE').replace(/[^a-zA-Z0-9_]/g,'').slice(0,56)+'\n');
    }
    // Do not falsify response shape for the pre-existing Stage7 caller.
    return result;
  };
}
