import { withErrorHandling, jsonOk } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { publicActor } from '@/server/http/guard';
import type { Currency } from '@/lib/types';
import { searchParams } from '@/server/http/request';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

/** Catalogue of methods; with no provider they are listed as unavailable with a reason. */
export const GET = withErrorHandling('payments.methods', async (ctx, request: Request) => {
  const services = createServices();
  const directionParam = searchParams(request).get('direction');
  const direction = directionParam === 'deposit' || directionParam === 'withdrawal' ? directionParam : undefined;
  const currencyParam = searchParams(request).get('currency');
  const currency = currencyParam && ['IRT','IRR','USD','EUR','GBP'].includes(currencyParam) ? currencyParam as Currency : undefined;
  void publicActor(request, ctx.correlationId);
  const methods = await services.paymentsService.methods(direction, currency);
  // Reads of the deposit/withdrawal switches are money gates: if they cannot be read we
  // fail CLOSED (both directions reported as disabled) and say so, never fail open.
  let depositsEnabled = false;
  let withdrawalsEnabled = false;
  let operationsUnavailable = false;
  try {
    const operations = await services.admin.operations();
    depositsEnabled = operations.find((o) => o.key === 'DEPOSITS')?.isEnabled ?? false;
    withdrawalsEnabled = operations.find((o) => o.key === 'WITHDRAWALS')?.isEnabled ?? false;
  } catch (error) {
    operationsUnavailable = true;
    logger.error('payments.methods.operations_unavailable', {
      correlationId: ctx.correlationId, message: error instanceof Error ? error.message : 'unknown error',
    });
  }
  return jsonOk({
    methods, depositsEnabled, withdrawalsEnabled, operationsUnavailable,
    providerConfigured: services.providers.payments.configured,
  });
});
