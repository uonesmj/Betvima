/**
 * Public, display-only availability for native clients.
 * Financial authorization stays on the server-side bet placement path.
 * A missing or unreadable operation must NEVER enable wagering.
 */
export interface MobileBettingOperation {
  key: string;
  isEnabled: boolean;
}

export function isMobileWageringAvailable(
  operations: readonly MobileBettingOperation[] | null | undefined,
): boolean {
  if (!Array.isArray(operations)) return false;

  const state = new Map<string, boolean>();
  for (const operation of operations) {
    if (!operation || typeof operation.key !== 'string' ||
        typeof operation.isEnabled !== 'boolean' ||
        state.has(operation.key)) {
      return false;
    }
    state.set(operation.key, operation.isEnabled);
  }

  return state.get('GLOBAL') === true &&
    state.get('BETTING') === true &&
    state.get('MAINTENANCE_MODE') === false &&
    (state.get('PREMATCH_BETTING') === true ||
      state.get('LIVE_BETTING') === true);
}
