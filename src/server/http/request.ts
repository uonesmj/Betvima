import { z, type ZodSchema } from 'zod';
import { ApiError } from '@/lib/errors';
import { createLogger } from '@/server/logger';
import { serverEnv } from '@/server/env';
import { getDb } from '@/server/db';
import type { HandlerContext } from '@/lib/errors';

/** Body size ceiling: refuses oversized payloads before any parsing happens. */
const MAX_BODY_BYTES = 256 * 1024;

export async function readJson<T>(request: Request, schema: ZodSchema<T>, ctx?: HandlerContext): Promise<T> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) throw new ApiError('PAYLOAD_TOO_LARGE', `Body exceeds ${MAX_BODY_BYTES} bytes`);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('BAD_REQUEST', 'Request body must be valid JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError('VALIDATION_FAILED', 'Request validation failed', {
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      correlationId: ctx?.correlationId,
    });
  }
  return parsed.data;
}

export function searchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

export function intParam(params: URLSearchParams, key: string, fallback: number, max = 100): number {
  const raw = params.get(key);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new ApiError('VALIDATION_FAILED', `Invalid ${key}`);
  return Math.min(value, max);
}

export const uuidParam = z.string().uuid();
export const isoDate = z.string().datetime({ offset: true });
export const moneyString = z.string().regex(/^\d{1,19}$/, 'Amount must be an integer in minor units');

/**
 * Distributed rate limiting through `nova.check_rate_limit` (fixed window, atomic).
 * Disabled by configuration, never silently skipped in production.
 */
export async function enforceRateLimit(bucket: string, limit: number, windowSeconds: number): Promise<void> {
  const env = serverEnv();
  if (!env.RATE_LIMIT_ENABLED) return;
  const db = getDb();
  const allowed = await db.rpc<boolean>('check_rate_limit', {
    p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (!allowed) {
    createLogger({ component: 'rate-limit' }).warn('rate limit exceeded', { bucket, limit, windowSeconds });
    throw new ApiError('RATE_LIMITED', 'Too many requests, please slow down', { retryAfterSeconds: windowSeconds });
  }
}

export function idempotencyKeyFrom(request: Request): string {
  const key = request.headers.get('idempotency-key') ?? request.headers.get('Idempotency-Key');
  if (!key || key.trim().length < 8) {
    throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 'An Idempotency-Key header of at least 8 characters is required');
  }
  return key.trim();
}
