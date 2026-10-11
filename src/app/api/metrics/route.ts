import { withErrorHandling } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { serverEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

/**
 * Prometheus-style metrics for the operations stack. Includes the financial control
 * totals that matter most (ledger vs. balances, payouts, open liability).
 */
export const GET = withErrorHandling('metrics', async (_ctx, request: Request) => {
  const env = serverEnv();
  if (env.METRICS_ENABLED === false) return new Response('# metrics disabled\n', { status: 404 });
  const secret = process.env.METRICS_TOKEN;
  if (secret) {
    const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (provided !== secret) return new Response('unauthorized\n', { status: 401 });
  }
  const services = createServices();
  const row = await services.db.queryOne<Record<string, unknown>>(
    `select
       (select count(*) from nova.profiles) as users_total,
       (select count(*) from nova.bets) as bets_total,
       (select count(*) from nova.bets where status in ('accepted','partially_settled')) as bets_open,
       (select coalesce(sum(balance_minor),0) from nova.wallets) as wallet_liability_minor,
       (select coalesce(sum(potential_payout_minor),0) from nova.bets where status in ('accepted','partially_settled')) as open_liability_minor,
       (select count(*) from nova.job_queue where status = 'queued') as jobs_queued,
       (select count(*) from nova.job_queue where status = 'failed') as jobs_failed,
       (select count(*) from nova.job_queue where status = 'dead_letter') as jobs_dead,
       (select count(*) from nova.affiliate_payouts where status in ('pending','eligible','approved','processing','manual_review')) as payouts_pending,
       (select count(*) from nova.worker_heartbeats where last_seen_at > now() - interval '60 seconds') as workers_alive,
       (select count(*) from nova.audit_logs where created_at > now() - interval '1 hour') as audits_1h`,
  );
  const num = (key: string): string => String(row?.[key] ?? 0);
  const lines = [
    '# HELP nova_info Build information',
    '# TYPE nova_info gauge',
    `nova_info{version="${process.env.npm_package_version ?? '1.0.0'}",environment="${env.APP_ENV}"} 1`,
    '# TYPE nova_users_total gauge', `nova_users_total ${num('users_total')}`,
    '# TYPE nova_bets_total counter', `nova_bets_total ${num('bets_total')}`,
    '# TYPE nova_bets_open gauge', `nova_bets_open ${num('bets_open')}`,
    '# TYPE nova_wallet_liability_minor gauge', `nova_wallet_liability_minor ${num('wallet_liability_minor')}`,
    '# TYPE nova_open_liability_minor gauge', `nova_open_liability_minor ${num('open_liability_minor')}`,
    '# TYPE nova_jobs gauge',
    `nova_jobs{status="queued"} ${num('jobs_queued')}`,
    `nova_jobs{status="failed"} ${num('jobs_failed')}`,
    `nova_jobs{status="dead_letter"} ${num('jobs_dead')}`,
    '# TYPE nova_payouts_pending gauge', `nova_payouts_pending ${num('payouts_pending')}`,
    '# TYPE nova_workers_alive gauge', `nova_workers_alive ${num('workers_alive')}`,
    '# TYPE nova_audit_events_1h gauge', `nova_audit_events_1h ${num('audits_1h')}`,
    '# TYPE nova_process_uptime_seconds gauge', `nova_process_uptime_seconds ${Math.round(process.uptime())}`,
  ];
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' },
  });
});
