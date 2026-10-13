import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Services } from '@/server/services/container';

const { activateVoucherMock, createVoucherMock, getCoinsMock } = vi.hoisted(() => ({
  activateVoucherMock: vi.fn(),
  createVoucherMock: vi.fn(),
  getCoinsMock: vi.fn(),
}));
vi.mock('@/server/providers/uwallet/client', () => ({
  activateVoucher: activateVoucherMock,
  createVoucher: createVoucherMock,
  getCoins: getCoinsMock,
}));

const intent = {
  id: 'payment-test-uuid',
  publicId: 'NP-TEST-VOUCHER-1',
  userId: 'user-test-uuid',
  status: 'initiated',
  amountMinor: 1000n,
  direction: 'deposit',
  currency: 'USD',
  methodId: 'voucher_uvoucher',
  providerReference: null,
  providerMetadata: null,
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ENV', 'test');
  vi.stubEnv('UWALLET_TOKEN', 'test-token-not-real');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'example-fixture-for-hmac-only-do-not-deploy');
  vi.stubEnv('UWALLET_UVOUCHER_COIN', 'UUSD');
  vi.stubEnv('UWALLET_HOTVOUCHER_COIN', 'HV');
  activateVoucherMock.mockReset();
  createVoucherMock.mockReset();
  getCoinsMock.mockReset();
  getCoinsMock.mockResolvedValue([
    { coin: 'UUSD', symbol: 'UUSD', swap: [{ coin: 'HV', percent: 252706220 }] },
    { coin: 'HV', symbol: 'HV' },
  ]);
});
afterEach(() => vi.unstubAllEnvs());

async function paymentService(services: Record<string, unknown>) {
  const { PaymentService } = await import('@/server/services/payment-service');
  return new PaymentService(services as unknown as Services);
}

describe('voucher money safety and email availability', () => {
  it('persists redeemed voucher reference before settlement, even when settlement fails', async () => {
    const createIntent = vi.fn().mockResolvedValue(intent);
    const completeIntent = vi.fn().mockResolvedValue({ intent: { ...intent, status: 'pending' } });
    const getIntent = vi.fn().mockResolvedValue({ ...intent, status: 'pending', providerReference: 'provider-txn' });
    const settleVoucherTransaction = vi.fn().mockRejectedValue(new Error('temporary settlement failure'));
    activateVoucherMock.mockResolvedValue({ transactionId: 'provider-txn', status: 'confirmed', receive: 10 });
    const service = await paymentService({
      users: { getProfile: vi.fn().mockResolvedValue({ preferredCurrency: 'USD' }) },
      payments: {
        createIntent, completeIntent, getIntent,
        updateIntentAmount: vi.fn().mockResolvedValue({ ...intent, amountMinor: 1000n }),
      },
      paymentsService: { settleVoucherTransaction },
    });
    await expect(service.createDeposit({
      userId: intent.userId, amountMinor: 1000n, currency: 'USD', methodId: 'voucher_uvoucher',
      voucherCode: 'sample-not-real', idempotencyKey: 'request-1', ip: null,
    })).rejects.toThrow('temporary settlement failure');
    expect(activateVoucherMock).toHaveBeenCalledTimes(1);
    expect(completeIntent).toHaveBeenCalledWith(expect.objectContaining({
      publicId: intent.publicId, status: 'pending', providerReference: 'provider-txn',
    }));
    expect(completeIntent).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('does not mint a voucher or hold funds when the email worker is offline', async () => {
    const createIntent = vi.fn();
    const service = await paymentService({
      providers: { email: { configured: true } },
      db: { queryOne: vi.fn().mockResolvedValue({ ready: false }) },
      payments: { createIntent },
    });
    await expect(service.createWithdrawal({
      userId: intent.userId, amountMinor: 150n, currency: 'USD', methodId: 'voucher_uvoucher',
      destination: 'test@example.com', idempotencyKey: 'request-2', ip: null,
    })).rejects.toThrow('Voucher email delivery is currently unavailable');
    expect(createIntent).not.toHaveBeenCalled();
    expect(createVoucherMock).not.toHaveBeenCalled();
  });

  it('does not issue a duplicate voucher for an already-pending withdrawal', async () => {
    const pending = { ...intent, direction: 'withdrawal', status: 'pending' };
    const service = await paymentService({
      providers: { email: { configured: true } },
      db: { queryOne: vi.fn().mockResolvedValue({ ready: true }) },
      payments: { createIntent: vi.fn().mockResolvedValue(pending) },
      users: { getProfile: vi.fn().mockResolvedValue({ preferredCurrency: 'USD' }) },
      notifications: { findByDedupeKey: vi.fn().mockResolvedValue(null) },
    });
    const result = await service.createWithdrawal({
      userId: intent.userId, amountMinor: 150n, currency: 'USD', methodId: 'voucher_uvoucher',
      destination: 'test@example.com', idempotencyKey: 'request-3', ip: null,
    });
    expect(result.status).toBe('pending');
    expect(createVoucherMock).not.toHaveBeenCalled();
  });

  it('pins uWallet FX before redeeming any IRT voucher deposit', async () => {
    const created = { ...intent, status: 'initiated' };
    const createIntent = vi.fn().mockResolvedValue(created);
    const completeIntent = vi.fn().mockResolvedValue({intent:{...created,status:'pending'}});
    activateVoucherMock.mockResolvedValue({transactionId:'provider-fixture',status:'pending',receive:'10'});
    const svc = await paymentService({
      users:{getProfile:vi.fn().mockResolvedValue({preferredCurrency:'IRT'})},
      payments:{createIntent,completeIntent},
    });
    await svc.createDeposit({ userId:intent.userId,amountMinor:1000n,currency:'USD',
      methodId:'voucher_uvoucher',voucherCode:'fixture-code',idempotencyKey:'deposit-rate-fixture',ip:null });
    expect(getCoinsMock).toHaveBeenCalledTimes(1);
    expect(createIntent).toHaveBeenCalledWith(expect.objectContaining({
      providerMetadata:expect.objectContaining({
        targetWalletCurrency:'IRT',
        voucherFx:expect.objectContaining({source:'uwallet',rateIrrPerUsd:'2527062.20000000'}),
      }),
    }));
    expect(completeIntent).toHaveBeenCalledWith(expect.objectContaining({
      status:'pending',providerReference:'provider-fixture',
    }));
  });

  it('rejects fiat withdrawal without valid provider quote before voucher issuance or wallet hold', async () => {
    const createIntent=vi.fn();
    const svc=await paymentService({
      providers:{email:{configured:true}},
      db:{queryOne:vi.fn().mockResolvedValue({ready:true})},
      users:{getProfile:vi.fn().mockResolvedValue({preferredCurrency:'IRR'})},
      payments:{createIntent},
    });
    await expect(svc.createWithdrawal({
      userId:intent.userId,amountMinor:949n,currency:'USD',methodId:'voucher_uvoucher',
      destination:'test@example.com',idempotencyKey:'missing-rate-quote',ip:null,
    })).rejects.toThrow('Refresh the uWallet voucher rate');
    expect(createIntent).not.toHaveBeenCalled();
    expect(createVoucherMock).not.toHaveBeenCalled();
  });

  it('refuses a forged signed rate without calling voucher API or reserving funds', async () => {
    const createIntent=vi.fn();
    const svc=await paymentService({
      providers:{email:{configured:true}},
      db:{queryOne:vi.fn().mockResolvedValue({ready:true})},
      users:{getProfile:vi.fn().mockResolvedValue({preferredCurrency:'IRT'})},
      payments:{createIntent},
    });
    await expect(svc.createWithdrawal({
      userId:intent.userId,amountMinor:949n,currency:'USD',methodId:'voucher_uvoucher',
      destination:'test@example.com',idempotencyKey:'forged-quote',ip:null,
      voucherQuote:{
        rateIrrPerUsd:'2527062.20000000',
        quotedAt:new Date().toISOString(),
        requestedWalletAmountMinor:'2400000',
        signature:'a'.repeat(64),
      },
    })).rejects.toThrow('modified');
    expect(createIntent).not.toHaveBeenCalled();
    expect(createVoucherMock).not.toHaveBeenCalled();
  });

  it('holds exactly the provider quoted IRR value and rejects a forged cent amount', async () => {
    const createIntent=vi.fn().mockResolvedValue({...intent,status:'initiated',direction:'withdrawal'});
    const db={queryOne:vi.fn()
      .mockResolvedValueOnce({ready:true})
      .mockResolvedValueOnce(null)};
    const svc=await paymentService({
      providers:{email:{configured:true}},
      db,
      users:{getProfile:vi.fn().mockResolvedValue({preferredCurrency:'IRR'})},
      payments:{createIntent},
      notifications:{findByDedupeKey:vi.fn().mockResolvedValue(null)},
    });
    const quotedAt=new Date().toISOString();
    const {signUwalletVoucherQuote}=await import('@/server/providers/uwallet/voucher-quote');
    const quote={
      rateIrrPerUsd:'2527062.20000000',quotedAt,requestedWalletAmountMinor:'24000000',
      signature:signUwalletVoucherQuote(intent.userId,'2527062.20000000',quotedAt),
    };
    const r=await svc.createWithdrawal({
      userId:intent.userId,amountMinor:949n,currency:'USD',methodId:'voucher_uvoucher',
      destination:'test@example.com',idempotencyKey:'rate-quote',ip:null,voucherQuote:quote,
    });
    expect(r.status).toBe('initiated');
    expect(createIntent).toHaveBeenCalledWith(expect.objectContaining({
      amountMinor:'949',
      providerMetadata:expect.objectContaining({voucherFx:expect.objectContaining({
        source:'uwallet',walletCurrency:'IRR',usdMinor:'949',requestedWalletAmountMinor:'24000000',
      })}),
    }));
    expect(createVoucherMock).not.toHaveBeenCalled();
  });

});
