import { describe, expect, it } from 'vitest';
import {
  assertVoucherRateStillCurrent,
  voucherUsdToWalletMinor,
  voucherWalletToUsdMinor,
  voucherWithdrawalDebit,
} from '@/lib/voucher-fx';

const rate = '2527062.20000000';

describe('uWallet voucher reference FX: exact integer accounting', () => {
  it('treats HotVoucher quote as IRR/USD and avoids a factor-of-ten mistake', () => {
    expect(voucherUsdToWalletMinor(100n, 'IRR', rate)).toBe(2527062n);
    expect(voucherUsdToWalletMinor(100n, 'IRT', rate)).toBe(252706n);
    expect(voucherUsdToWalletMinor(1000n, 'IRR', rate)).toBe(25270622n);
    expect(voucherUsdToWalletMinor(1000n, 'IRT', rate)).toBe(2527062n);
  });

  it('converts equivalent IRR and IRT amounts into identical USD cents', () => {
    expect(voucherWalletToUsdMinor(24000000n, 'IRR', rate)).toBe(949n);
    expect(voucherWalletToUsdMinor(2400000n, 'IRT', rate)).toBe(949n);
  });

  it('never debits more than requested after cent rounding', () => {
    for (const [walletMinor,currency] of [
      [24000000n,'IRR'],
      [2400000n,'IRT'],
      [3790600n,'IRR'],
      [379060n,'IRT'],
    ] as const) {
      const {usdMinor,walletMinor:debit}=voucherWithdrawalDebit(walletMinor,currency,rate);
      expect(debit).toBeLessThanOrEqual(walletMinor);
      expect(debit).toBe(voucherUsdToWalletMinor(usdMinor,currency,rate));
    }
  });

  it('rejects forged, zero and out-of-range quotes', () => {
    for (const invalid of ['0','-1','2e6','2500000.123456789','100','100000001']) {
      expect(() => voucherWalletToUsdMinor(1000000n,'IRT',invalid)).toThrow();
    }
    expect(() => voucherWalletToUsdMinor(-1n,'IRR',rate)).toThrow();
  });

  it('accepts tiny reference rate drift but rejects larger market movement', () => {
    expect(() => assertVoucherRateStillCurrent(rate, '2527162.20000000')).not.toThrow();
    expect(() => assertVoucherRateStillCurrent(rate, '2600000.00000000')).toThrow('rate changed');
  });
});
