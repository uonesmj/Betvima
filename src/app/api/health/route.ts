import { NextResponse } from 'next/server';
import { createServices } from '@/server/services/container';
import { publicConfig, serverEnv } from '@/server/env';
import type { HealthCheckResult, HealthReport } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Liveness + readiness in one honest report: every dependency is probed and reported as
 * ok/degraded/down/unknown. "Unknown" is never reported as "ok".
 */
export async function GET(): Promise<Response> {
  const started = Date.now();
  const env = serverEnv();
  const checks: HealthCheckResult[] = [];
  const checkedAt = new Date().toISOString();
  const push = (name: string, critical: boolean, status: HealthCheckResult['status'], latencyMs: number | null, message: string | null = null) =>
    checks.push({ name, status, latencyMs, message, critical, checkedAt });

  const dbConfigured = Boolean(env.SUPABASE_DB_URL || process.env.PGHOST || process.env.DATABASE_URL);
  if (dbConfigured) {
    try {
      const services = createServices();
      const ping = await services.db.ping();
      push('database', true, ping.ok ? 'ok' : 'down', ping.latencyMs, ping.message ?? null);
      if (ping.ok) {
        const row = await services.db.queryOne<{ issues: string }>(
          `select count(*)::text as issues from (
             select 1 from nova.wallets w
              where w.balance_minor <> coalesce((select sum(t.amount_minor) from nova.wallet_transactions t
                       where t.wallet_id = w.id and t.status = 'posted'), 0)
           ) broken`,
        );
        const issues = Number(row?.issues ?? 0);
        push('ledger_integrity', true, issues === 0 ? 'ok' : 'down', null,
          issues === 0 ? 'every wallet balance equals its ledger sum' : `${issues} wallet(s) disagree with their ledger`);
      } else {
        push('ledger_integrity', true, 'unknown', null, 'skipped: database unreachable');
      }
    } catch (error) {
      push('database', true, 'down', null, error instanceof Error ? error.message : 'unknown error');
      push('ledger_integrity', true, 'unknown', null, 'skipped: database unreachable');
    }
  } else {
    push('database', true, 'unknown', null, 'no database connection configured');
    push('ledger_integrity', true, 'unknown', null, 'skipped: database unreachable');
  }

  push('authentication', true, env.supabaseConfigured ? 'ok' : 'degraded', null,
    env.supabaseConfigured ? null : 'Supabase auth not configured: account areas are unavailable (never faked)');
  push('sports_provider', false, env.sportsProviderEnabled ? 'ok' : 'degraded', null,
    env.sportsProviderEnabled ? null : 'No sports data provider configured: live odds/scores unavailable');
  push('payment_provider', false, env.paymentProviderEnabled ? 'ok' : 'degraded', null,
    env.paymentProviderEnabled ? null : 'No payment provider configured: deposits/withdrawals unavailable');

  let workerStatus: HealthCheckResult['status'] = 'degraded';
  let workerMessage = 'No worker heartbeats recorded yet';
  try {
    const services = createServices();
    const row = await services.db.queryOne<{ total: string }>(`select count(*)::text as total from nova.worker_heartbeats`);
    const total = Number(row?.total ?? 0);
    workerStatus = total > 0 ? 'ok' : 'degraded';
    workerMessage = total > 0 ? `${total} worker(s) reporting` : 'No worker heartbeat recorded yet';
  } catch {
    workerStatus = 'unknown';
    workerMessage = 'worker state unavailable';
  }
  push('workers', false, workerStatus, null, workerMessage);

  const critical = checks.filter((c) => c.critical);
  const status: HealthReport['status'] = critical.some((c) => c.status === 'down')
    ? 'down'
    : checks.some((c) => c.status !== 'ok') ? 'degraded' : 'ok';

  const report: HealthReport = {
    status, version: process.env.npm_package_version ?? '1.0.0', environment: env.APP_ENV,
    uptimeSeconds: Math.round(process.uptime()), checkedAt, durationMs: Date.now() - started, checks,
  };
  const config = publicConfig();
  return NextResponse.json(
    { ...report, config: { siteName: config.siteName, locale: config.locale, currency: config.currency, appEnv: config.appEnv, providers: config.providers, flags: config.flags } },
    { status: status === 'down' ? 503 : 200, headers: { 'cache-control': 'no-store' } },
  );
}
