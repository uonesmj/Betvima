import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Services } from '@/server/services/container';

const { activateVoucherMock, createVoucherMock } = vi.hoisted(() => ({
  activateVoucherMock: vi.fn(),
  createVoucherMock: vi.fn(),
}));
vi.mock('@/server/providers/uwallet/client', () => ({
  activateVoucher: activateVoucherMock,
  createVoucher: createVoucherMock,
  getCoins: vi.fn(),
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
  vi.stubEnv('UWALLET_UVOUCHER_COIN', 'UUSD');
  vi.stubEnv('UWALLET_HOTVOUCHER_COIN', 'HV');
  activateVoucherMock.mockReset();
  createVoucherMock.mockReset();
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
});
