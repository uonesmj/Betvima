import { logger } from '@/server/logger';

/**
 * Honest partial-failure handling for composite read endpoints.
 *
 * An admin screen is often assembled from several independent queries. Wrapping each one in
 * `catch(() => [])` would turn a broken query into a reassuring empty list - an operator
 * would see "nothing to review" while the queue is actually unreadable. Instead every
 * section either succeeds or is reported in the response as a degradation entry, and the
 * failure is logged with the correlation id.
 */
export interface DegradedSection {
  section: string;
  message: string;
}

export async function section<T>(
  label: string,
  degraded: DegradedSection[],
  run: () => Promise<T>,
  fallback: T,
  correlationId?: string | null,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'section query failed';
    degraded.push({ section: label, message });
    logger.error('section.degraded', { section: label, message, correlationId: correlationId ?? null });
    return fallback;
  }
}
