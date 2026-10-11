import type { AdminRepository } from '@/lib/ports/repositories';

/** Only an explicit boolean true enables live betting. Missing, malformed, or unreadable state fails closed. */
export function isLiveBettingEnabled(operations: unknown): boolean {
  if (!Array.isArray(operations)) return false;

  const matchingOperations = operations.filter(
    (entry): entry is { key: string; isEnabled: unknown } =>
      typeof entry === 'object' && entry !== null && 'key' in entry && entry.key === 'LIVE_BETTING',
  );

  return matchingOperations.length === 1 && matchingOperations[0]?.isEnabled === true;
}

export async function readLiveBettingEnabled(
  admin: Pick<AdminRepository, 'operations'>,
): Promise<boolean> {
  try {
    return isLiveBettingEnabled(await admin.operations());
  } catch {
    return false;
  }
}

/** A failed live-catalogue read disables the surface instead of failing the whole page. */
export async function readLiveCatalogue<T>(
  read: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; unavailable: boolean }> {
  try {
    return { value: await read(), unavailable: false };
  } catch {
    return { value: fallback, unavailable: true };
  }
}
