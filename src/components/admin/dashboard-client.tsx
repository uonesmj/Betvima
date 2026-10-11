'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Metrics {
  generatedAt: string; window: string;
  users: { total: number; active24h: number; new24h: number; verified: number };
  betting: { bets24h: number; stake24hMinor: string; payout24hMinor: string; ggr24hMinor: string; openBets: number; openLiabilityMinor: string; avgStakeMinor: string; marginPct: number };
  wallet: { deposits24hMinor: string; withdrawals24hMinor: string; totalLiabilityMinor: string; pendingWithdrawals: number };
  affiliate: { activeAffiliates: number; commission24hMinor: string; payableMinor: string; pendingPayouts: number; pendingPayoutAmountMinor: string };
  risk: { flaggedUsers: number; manualReviewBets: number; failedWebhooks24h: number; settlementBacklog: number };
  providers: { sports: string; payments: string; lastOddsSyncAt: string | null; lastSettlementAt: string | null };
}

interface JobStat {
  queue: string; pending: number; running: number; failed: number; dead: number; oldestPendingSeconds: number | null;
}
interface Worker { workerId: string; queue: string; status: string; lastSeenAt: string; processedCount: number; failedCount: number; hostname: string | null; version: string | null }
interface ProviderStatus { provider: string; category: string; configured: boolean; enabled: boolean; reachable: boolean | null; requiredEnv: string[]; notes: string | null }

export function DashboardClient() {
  const { t, locale } = useApp();
  const [window, setWindow] = useState<'24h' | '7d' | '30d'>('24h');
  const { data, loading, error, reload } = useApiQuery<{ metrics: Metrics; jobStats: JobStat[]; workers: Worker[]; providers: ProviderStatus[] }>(
    `/api/v1/admin/dashboard?window=${window}`, { pollMs: 60_000 },
  );

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error && !data) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const m = data!.metrics;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['24h', '7d', '30d'] as const).map((option) => (
          <button key={option} type="button" className={`nova-tab ${window === option ? 'nova-tab-active' : ''}`} onClick={() => setWindow(option)}>{option}</button>
        ))}
        <span className="ms-auto text-xs nova-muted">Generated {formatDateTime(m.generatedAt, locale)}</span>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Betting</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Bets" value={m.betting.bets24h} />
          <Stat label="Stake" value={formatMinor(m.betting.stake24hMinor, 'USD', locale)} />
          <Stat label="Payout" value={formatMinor(m.betting.payout24hMinor, 'USD', locale)} />
          <Stat label="GGR" value={formatMinor(m.betting.ggr24hMinor, 'USD', locale)} tone={BigInt(m.betting.ggr24hMinor) >= 0n ? 'success' : 'danger'} />
          <Stat label="Open bets" value={m.betting.openBets} />
          <Stat label="تعهدات Open" value={formatMinor(m.betting.openLiabilityMinor, 'USD', locale)} tone="warning" />
          <Stat label="Average stake" value={formatMinor(m.betting.avgStakeMinor, 'USD', locale)} />
          <Stat label="Margin" value={`${m.betting.marginPct.toFixed(2)}%`} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Wallet</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Deposits" value={formatMinor(m.wallet.deposits24hMinor, 'USD', locale)} />
          <Stat label="Withdrawals" value={formatMinor(m.wallet.withdrawals24hMinor, 'USD', locale)} />
          <Stat label="Customer balance liability" value={formatMinor(m.wallet.totalLiabilityMinor, 'USD', locale)} tone="warning" />
          <Stat label="Pending withdrawals" value={m.wallet.pendingWithdrawals} tone={m.wallet.pendingWithdrawals > 0 ? 'warning' : undefined} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Affiliates & risk</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active affiliates" value={m.affiliate.activeAffiliates} />
          <Stat label="Commission (period)" value={formatMinor(m.affiliate.commission24hMinor, 'USD', locale)} />
          <Stat label="Affiliate payable" value={formatMinor(m.affiliate.payableMinor, 'USD', locale)} />
          <Stat label="Payouts pending" value={`${m.affiliate.pendingPayouts} · ${formatMinor(m.affiliate.pendingPayoutAmountMinor, 'USD', locale)}`} />
          <Stat label="Flagged affiliates" value={m.risk.flaggedUsers} tone={m.risk.flaggedUsers > 0 ? 'warning' : undefined} />
          <Stat label="Manual review bets" value={m.risk.manualReviewBets} tone={m.risk.manualReviewBets > 0 ? 'warning' : undefined} />
          <Stat label="Failed webhooks" value={m.risk.failedWebhooks24h} tone={m.risk.failedWebhooks24h > 0 ? 'danger' : undefined} />
          <Stat label="Settlement backlog" value={m.risk.settlementBacklog} tone={m.risk.settlementBacklog > 0 ? 'warning' : undefined} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Providers</h2>
          <ul className="space-y-1.5 text-xs">
            {(data!.providers ?? []).map((provider) => (
              <li key={`${provider.category}-${provider.provider}`} className="flex items-center justify-between gap-2 border-b border-nova-line/50 pb-1.5">
                <span>{provider.category} · <span className="nova-muted">{provider.provider}</span></span>
                <span className="flex items-center gap-2">
                  <span className="nova-muted">{provider.requiredEnv?.join(', ')}</span>
                  <StatusPill status={provider.enabled && provider.configured ? 'active' : 'disabled'} />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] nova-muted">
            Last odds sync: {formatDateTime(m.providers.lastOddsSyncAt, locale)} · last settlement: {formatDateTime(m.providers.lastSettlementAt, locale)}
          </p>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Queues</h2>
          {(data!.jobStats ?? []).length === 0 ? <p className="text-xs nova-muted">No jobs recorded yet.</p> : (
            <ul className="space-y-1.5 text-xs">
              {data!.jobStats.map((stat) => (
                <li key={stat.queue} className="border-b border-nova-line/50 pb-1.5">
                  <div className="flex items-center justify-between">
                    <span>{stat.queue}</span>
                    <span className="nova-muted">
                      queued {stat.pending} · running {stat.running} · failed {stat.failed} · dead-letter {stat.dead}
                    </span>
                  </div>
                  {stat.oldestPendingSeconds !== null ? (
                    <div className="text-[10px] nova-muted">oldest waiting job: {Math.round(stat.oldestPendingSeconds)}s</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-2 mt-4 text-sm font-semibold">Workers</h2>
          {(data!.workers ?? []).length === 0 ? <p className="text-xs nova-muted">No worker heartbeat yet — start a worker process to see it here.</p> : (
            <ul className="space-y-1.5 text-xs">
              {data!.workers.map((worker) => (
                <li key={worker.workerId} className="flex items-center justify-between border-b border-nova-line/50 pb-1.5">
                  <span>{worker.queue}</span>
                  <span className="flex items-center gap-2 nova-muted">
                    {worker.hostname ?? ''} {formatDateTime(worker.lastSeenAt, locale)}
                    <span className="nova-muted">{worker.processedCount}/{worker.failedCount}</span>
                    <StatusPill status={worker.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
