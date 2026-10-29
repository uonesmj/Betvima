/**
 * Opt-in, read-only latency telemetry for authenticated SoftAggregator callbacks.
 * Never log player identifiers, amounts, URL/query strings, SQL values or keys.
 * Timings are grouped by fixed SQL operation labels.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

type Duration = { count: number; totalMs: number; maxMs: number };
type Trace = { phases: Record<string, Duration> };
const context = new AsyncLocalStorage<Trace>();
const ms = () => Number(process.hrtime.bigint()) / 1_000_000;
const round = (value: number) => Math.round(value * 10) / 10;

export function casinoSqlLabel(sql: string): string {
  const s = sql.trimStart().toLowerCase();
  if (s.startsWith('select pg_advisory_xact_lock')) return 'db.lock';
  if (s.includes('to_regclass(\'nova.softaggregator_callback_receipts\')')) return 'db.schema';
  if (s.includes('softaggregator_player_wallet_bindings')) return 'db.wallet_binding';
  if (s.includes('softaggregator_round_fx')) return 'db.round';
  if (s.includes('softaggregator_callback_receipts')) return 'db.receipt';
  if (s.includes('post_wallet_entry')) return 'db.ledger';
  if (s.includes('nova.wallets')) return 'db.wallet';
  if (s.includes('nova.wallet_transactions')) return 'db.limits';
  if (s.includes('nova.profiles') || s.includes('nova.user_limits')) return 'db.profile';
  return 'db.other';
}

export async function measureCasinoDb<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const active = context.getStore();
  if (!active) return fn();
  const start = ms();
  try {
    return await fn();
  } finally {
    const duration = Math.max(0, ms() - start);
    const current = active.phases[label] ?? { count: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    current.totalMs += duration;
    current.maxMs = Math.max(current.maxMs, duration);
    active.phases[label] = current;
  }
}

export async function traceCasinoCallback<T>(
  action: 'balance' | 'debit' | 'credit', rollback: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  if (process.env.SOFTAGGREGATOR_CALLBACK_PERF_TRACE !== 'true') return fn();
  const trace: Trace = { phases: Object.create(null) as Record<string, Duration> };
  const started = ms();
  let outcome = 'failed';
  return context.run(trace, async () => {
    try {
      const value = await fn();
      outcome = 'completed';
      return value;
    } finally {
      const phases = Object.fromEntries(
        Object.entries(trace.phases)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, timing]) => [
            name,
            { count: timing.count, total_ms: round(timing.totalMs), max_ms: round(timing.maxMs) },
          ]),
      );
      console.info(JSON.stringify({
        event: 'casino.callback.latency',
        action, rollback, outcome,
        total_ms: round(Math.max(0, ms() - started)),
        phases,
      }));
    }
  });
}
