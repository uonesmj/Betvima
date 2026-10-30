/**
 * Pure, synthetic FX parity vectors for the active BetVima 3098 fx.ts.
 * No provider credentials, network, identities, balances or database writes.
 */
import {
  parseIrtUsdRate, casinoUsdToLocalMinor, casinoLocalMinorToUsd,
  exactCasinoRefund, validateCasinoFxSnapshot,
} from './fx.ts';

type Check = Readonly<{name: string; passed: boolean}>;

export function runSyntheticFxChecks(now = Date.now()): Check[] {
  const checks: Check[] = [];
  const same = (name: string, fn: () => unknown, expected: unknown) => {
    let passed = false;
    try { passed = fn() === expected; } catch { passed = false; }
    checks.push({name, passed});
  };
  const mustReject = (name: string, fn: () => unknown) => {
    let passed = false;
    try { fn(); } catch { passed = true; }
    checks.push({name, passed});
  };
  const rate = '100001.125';
  const good = {
    source: 'arzhaam' as const,
    rateIrtPerUsd: rate,
    observedAt: new Date(now - 1000).toISOString(),
    fetchedAt: new Date(now).toISOString(),
  };
  same('rate_exact_decimal', () => parseIrtUsdRate(rate), 10000112500000n);
  same('rate_minimum', () => parseIrtUsdRate('1000'), 100000000000n);
  same('rate_maximum', () => parseIrtUsdRate('10000000'), 1000000000000000n);
  mustReject('rate_zero', () => parseIrtUsdRate('0'));
  mustReject('rate_too_low', () => parseIrtUsdRate('999.99'));
  mustReject('rate_too_high', () => parseIrtUsdRate('10000000.01'));
  mustReject('rate_scientific_notation', () => parseIrtUsdRate('1e5'));
  mustReject('rate_excess_precision', () => parseIrtUsdRate('100000.000000001'));
  mustReject('rate_string_injection', () => parseIrtUsdRate('100000; select 1'));
  same('usd_to_irt_exact', () => casinoUsdToLocalMinor(100n, 'IRT', '100000', 'up'), 100000n);
  same('usd_to_irr_exact', () => casinoUsdToLocalMinor(100n, 'IRR', '100000', 'up'), 1000000n);
  same('irt_debit_ceil', () => casinoUsdToLocalMinor(10n, 'IRT', rate, 'up'), 10001n);
  same('irt_credit_floor', () => casinoUsdToLocalMinor(10n, 'IRT', rate, 'down'), 10000n);
  same('irr_debit_ceil', () => casinoUsdToLocalMinor(10n, 'IRR', rate, 'up'), 100002n);
  same('irr_credit_floor', () => casinoUsdToLocalMinor(10n, 'IRR', rate, 'down'), 100001n);
  same('zero_usd', () => casinoUsdToLocalMinor(0n, 'IRT', '100000', 'up'), 0n);
  same('usd_passthrough', () => casinoUsdToLocalMinor(123n, 'USD', '100000', 'up'), 123n);
  same('irt_balance_usd_floor', () => casinoLocalMinorToUsd(100001n, 'IRT', '100000'), 100n);
  same('irr_balance_usd_floor', () => casinoLocalMinorToUsd(1000001n, 'IRR', '100000'), 100n);
  mustReject('reject_negative_amount', () => casinoUsdToLocalMinor(-1n, 'IRT', rate, 'up'));
  mustReject('reject_over_max_amount', () => casinoUsdToLocalMinor(1000000000001n, 'IRT', rate, 'up'));
  mustReject('reject_negative_wallet_balance', () => casinoLocalMinorToUsd(-1n, 'IRT', rate));
  same('exact_original_refund', () => exactCasinoRefund(10001n, 10n, 10n), 10001n);
  mustReject('reject_wrong_refund_amount', () => exactCasinoRefund(10001n, 10n, 9n));
  mustReject('reject_missing_original_refund', () => exactCasinoRefund(0n, 10n, 10n));
  same('accept_fresh_quote', () => validateCasinoFxSnapshot(good, now), 10000112500000n);
  mustReject('reject_stale_observed', () => validateCasinoFxSnapshot({...good, observedAt: new Date(now - 121000).toISOString()}, now));
  mustReject('reject_stale_fetch', () => validateCasinoFxSnapshot({...good, fetchedAt: new Date(now - 31000).toISOString()}, now));
  mustReject('reject_future_observation', () => validateCasinoFxSnapshot({...good, observedAt: new Date(now + 11000).toISOString()}, now));
  mustReject('reject_wrong_fx_source', () => validateCasinoFxSnapshot({...good, source: 'other' as 'arzhaam'}, now));
  mustReject('reject_absent_provider_timestamp', () => validateCasinoFxSnapshot({...good, observedAt: ''}, now));
  mustReject('reject_invalid_quote_rate', () => validateCasinoFxSnapshot({...good, rateIrtPerUsd: 'Infinity'}, now));
  return checks;
}
