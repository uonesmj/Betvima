/** Shared conservative request cap for all BetsAPI adapters and worker planners.
 * Operator-controlled higher quotas must be explicitly configured only after
 * verifying the upstream allowance. Never infer the purchased plan from UI data.
 */
export const DEFAULT_BETSAPI_HOURLY_REQUEST_BUDGET = 200;
export const MAX_BETSAPI_HOURLY_REQUEST_BUDGET = 199_999;

export function resolveBetsapiHourlyBudget(rawBudget: string | undefined): number {
  const parsed = Number(rawBudget);
  return Number.isSafeInteger(parsed) && parsed >= 50
    ? Math.min(parsed, MAX_BETSAPI_HOURLY_REQUEST_BUDGET)
    : DEFAULT_BETSAPI_HOURLY_REQUEST_BUDGET;
}
