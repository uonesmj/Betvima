import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '@/lib/errors';
import { serverEnv } from '@/server/env';

function quoteSignature(userId: string, rate: string, quotedAt: string): string {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new ApiError('PAYMENT_PROVIDER_DISABLED', 'Voucher FX quote signing is not configured');
  return createHmac('sha256', key)
    .update('betvima:uwallet:reference:2026:v1\\n')
    .update(userId).update('\\n').update(rate).update('\\n').update(quotedAt)
    .digest('hex');
}

export function signUwalletVoucherQuote(userId: string, rate: string, quotedAt: string): string {
  return quoteSignature(userId, rate, quotedAt);
}

export function verifyUwalletVoucherQuote(
  userId: string, rate: string, quotedAt: string, signature: string,
): void {
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    throw new ApiError('BAD_REQUEST', 'uWallet voucher rate signature missing or invalid');
  }
  const expected = Buffer.from(quoteSignature(userId, rate, quotedAt), 'hex');
  const supplied = Buffer.from(signature, 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new ApiError('BAD_REQUEST', 'uWallet voucher FX quote has been modified');
  }
}
