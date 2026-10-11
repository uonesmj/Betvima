import { withErrorHandling } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * Manual payout confirmation is disabled.
 * Crypto withdrawals must only be completed from the NOWPayments Mass Payout
 * execution flow after explicit approval.
 */
export const POST = withErrorHandling(
  'admin.payments.mark_paid',
  async () => {
    throw new Error('MANUAL_CRYPTO_PAYOUT_DISABLED');
  },
);
