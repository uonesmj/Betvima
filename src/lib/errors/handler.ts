import { NextResponse } from 'next/server';
import { ApiError } from './api-error';
import { createLogger } from '@/server/logger';
import { newCorrelationId } from '@/server/utils/ids';
// Side-effect import: registers the global bigint->decimal-string JSON serialiser for every route.
import '@/server/json';

const log = createLogger({ component: 'api' });

export interface HandlerContext {
  correlationId: string;
  logger: ReturnType<typeof createLogger>;
}

/**
 * Wrap a route handler: standard error envelope, correlation id, structured logging,
 * no stack traces or secrets leaked to the client.
 */
export function withErrorHandling<Args extends unknown[]>(
  name: string,
  handler: (ctx: HandlerContext, ...args: Args) => Promise<Response> | Response,
) {
  return async (...args: Args): Promise<Response> => {
    const correlationId = newCorrelationId();
    const logger = log.child({ route: name, correlationId });
    const started = Date.now();
    try {
      const response = await handler({ correlationId, logger }, ...args);
      logger.info('request.completed', { status: response.status, durationMs: Date.now() - started });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch (error) {
      const apiError = ApiError.from(error);
      const level = apiError.status >= 500 ? 'error' : apiError.status >= 400 ? 'warn' : 'info';
      logger[level]('request.failed', {
        code: apiError.code, status: apiError.status, durationMs: Date.now() - started,
        message: apiError.message, details: apiError.expose ? apiError.details : undefined,
      });
      return NextResponse.json(apiError.toBody(), {
        status: apiError.status,
        headers: {
          'x-correlation-id': correlationId,
          ...(apiError.status === 401 ? { 'www-authenticate': 'Bearer' } : {}),
          ...(apiError.retryAfterSeconds !== undefined ? { 'retry-after': String(apiError.retryAfterSeconds) } : {}),
        },
      });
    }
  };
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function jsonCreated<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 201, ...init });
}
