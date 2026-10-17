'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Activity, CreditCard, Headphones, Users } from 'lucide-react';
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
interface JobStat { queue: string; pending: number; running: number; failed: number; dead: number; oldestPendingSeconds: number | null }
interface Worker { workerId: string; queue: string; status: string; lastSeenAt: string; processedCount: number; failedCount: number; hostname: string | null; version: string | null }
interface ProviderStatus { provider: string; category: string; configured: boolean; enabled: boolean; reachable: boolean | null; requiredEnv: string[]; notes: string | null }

const QUICK_LINKS = [
  { href: '/admin/users', label: 'Customer accounts', helper: 'Find and review users', icon: Users },
  { href: '/admin/payments', label: 'Payments & withdrawals', helper: 'Review payment activity', icon: CreditCard },
  { href: '/admin/support', label: 'Support inbox', helper: 'Customer conversations', icon: Headphones },
  { href: '/admin/health', label: 'System health', helper: 'Services and availability', icon: Activity },
];

export function DashboardClient() {
  const { t, locale } = useApp();
  const [window, setWindow] = useState<'24h' | '7d' | '30d'>('24h');
  const { data, loading, error, reload } = useApiQuery<{ metrics: Metrics; jobStats: JobStat[]; workers: Worker[]; providers: ProviderStatus[] }>(
    `/api/v1/admin/dashboard?window=${window}`, { pollMs: 60_000 },
  );

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error && !data) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;
  if (!data) return <ErrorNote message="Dashboard data is unavailable." onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const m = data.metrics;
  const money = (minor: string) => formatMinor(minor, 'USD', locale);
  return (
    <div className="bv-admin-dashboard space-y-5">
      <div className="bv-admin-overview">
        <div className="bv-admin-overview-copy">
          <span className="bv-admin-overview-eyebrow"><span /> OPERATIONS OVERVIEW</span>
          <h2>Business at a glance</h2>
          <p>A clear view of your customers, trading activity, payment flow and operational health.</p>
          <div className="bv-admin-overview-updated">Updated {formatDateTime(m.generatedAt, locale)}</div>
        </div>
        <div className="bv-admin-period-selector" role="group" aria-label="Metrics time range">
          {(['24h', '7d', '30d'] as const).map((option) => (
            <button key={option} type="button" aria-pressed={window === option}
              className={window === option ? 'is-selected' : ''} onClick={() => setWindow(option)}>{option}</button>
          ))}
        </div>
      </div>

      {error ? <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} /> : null}

      <section aria-label="Key metrics">
        <div className="bv-admin-section-heading">
          <div><span>01 / PERFORMANCE</span><h2>Key metrics</h2></div>
          <span className="bv-admin-section-hint">Selected period: {window}</span>
        </div>
        <div className="bv-admin-kpi-grid">
          <Stat label="Bets placed" value={m.betting.bets24h} hint="Wagers in selected period" />
          <Stat label="Gross gaming revenue" value={money(m.betting.ggr24hMinor)}
            tone={BigInt(m.betting.ggr24hMinor) >= 0n ? 'success' : 'danger'} hint="Net of betting payout" />
          <Stat label="Deposits" value={money(m.wallet.deposits24hMinor)} hint="Incoming payment volume" />
          <Stat label="Pending withdrawals" value={m.wallet.pendingWithdrawals}
            tone={m.wallet.pendingWithdrawals > 0 ? 'warning' : undefined} hint="Requires operational visibility" />
        </div>
      </section>

      <div className="bv-admin-dashboard-columns">
        <section>
          <div className="bv-admin-section-heading"><div><span>02 / TRADING</span><h2>Betting & exposure</h2></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Total stakes" value={money(m.betting.stake24hMinor)} />
            <Stat label="Total payouts" value={money(m.betting.payout24hMinor)} />
            <Stat label="Open bets" value={m.betting.openBets} />
            <Stat label="Open liabilities" value={money(m.betting.openLiabilityMinor)} tone="warning" />
            <Stat label="Average stake" value={money(m.betting.avgStakeMinor)} />
            <Stat label="Trading margin" value={`${m.betting.marginPct.toFixed(2)}%`} />
          </div>
        </section>
        <section>
          <div className="bv-admin-section-heading"><div><span>03 / ACCOUNTS</span><h2>Customers & wallet</h2></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Registered customers" value={m.users.total} />
            <Stat label="New accounts" value={m.users.new24h} hint="As returned by the reporting API" />
            <Stat label="Active customers" value={m.users.active24h} />
            <Stat label="Verified customers" value={m.users.verified} />
            <Stat label="Withdrawals" value={money(m.wallet.withdrawals24hMinor)} />
            <Stat label="Customer balance liability" value={money(m.wallet.totalLiabilityMinor)} tone="warning" />
          </div>
        </section>
      </div>

      <div className="bv-admin-dashboard-columns">
        <section>
          <div className="bv-admin-section-heading"><div><span>04 / AFFILIATES</span><h2>Partners & commissions</h2></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Active affiliates" value={m.affiliate.activeAffiliates} />
            <Stat label="Commission (period)" value={money(m.affiliate.commission24hMinor)} />
            <Stat label="Affiliate payable" value={money(m.affiliate.payableMinor)} />
            <Stat label="Pending partner payouts" value={`${m.affiliate.pendingPayouts} · ${money(m.affiliate.pendingPayoutAmountMinor)}`} />
          </div>
        </section>
        <section>
          <div className="bv-admin-section-heading"><div><span>05 / CONTROLS</span><h2>Risk & exceptions</h2></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Flagged users" value={m.risk.flaggedUsers} tone={m.risk.flaggedUsers > 0 ? 'warning' : undefined} />
            <Stat label="Manual bet reviews" value={m.risk.manualReviewBets} tone={m.risk.manualReviewBets > 0 ? 'warning' : undefined} />
            <Stat label="Failed webhooks" value={m.risk.failedWebhooks24h} tone={m.risk.failedWebhooks24h > 0 ? 'danger' : undefined} />
            <Stat label="Settlement backlog" value={m.risk.settlementBacklog} tone={m.risk.settlementBacklog > 0 ? 'warning' : undefined} />
          </div>
        </section>
      </div>

      <section>
        <div className="bv-admin-section-heading"><div><span>06 / WORKSPACE</span><h2>Quick navigation</h2></div></div>
        <div className="bv-admin-shortcut-grid">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return <Link href={item.href} key={item.href} className="bv-admin-shortcut">
              <span className="bv-admin-shortcut-icon"><Icon size={20} aria-hidden="true" /></span>
              <span className="bv-admin-shortcut-copy"><strong>{item.label}</strong><small>{item.helper}</small></span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>;
          })}
        </div>
      </section>

      <div className="bv-admin-dashboard-columns">
        <Card>
          <div className="bv-admin-section-heading"><div><span>07 / SERVICES</span><h2>Data & payment providers</h2></div></div>
          <ul className="bv-admin-detail-list">
            {(data.providers ?? []).map((provider) => (
              <li key={`${provider.category}-${provider.provider}`}>
                <span><strong>{provider.category}</strong><small>{provider.provider}</small>
                  {provider.requiredEnv?.length ? <small>Configured requirements: {provider.requiredEnv.join(', ')}</small> : null}
                </span>
                <StatusPill status={provider.enabled && provider.configured ? 'active' : 'disabled'} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs nova-muted">
            Last odds sync: {formatDateTime(m.providers.lastOddsSyncAt, locale)}
            {' · '}Last settlement: {formatDateTime(m.providers.lastSettlementAt, locale)}
          </p>
        </Card>
        <Card>
          <div className="bv-admin-section-heading"><div><span>08 / SYSTEM</span><h2>Queues & workers</h2></div></div>
          {(data.jobStats ?? []).length === 0 ? <p className="text-xs nova-muted">No jobs recorded yet.</p> : (
            <ul className="bv-admin-detail-list">
              {data.jobStats.map((stat) => (
                <li key={stat.queue}>
                  <span><strong>{stat.queue}</strong><small>Queued {stat.pending} · Running {stat.running} · Failed {stat.failed} · Dead-letter {stat.dead}</small>
                    {stat.oldestPendingSeconds !== null ? <small>Oldest waiting: {Math.round(stat.oldestPendingSeconds)}s</small> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 mb-2 text-sm font-semibold">Worker heartbeat</h3>
          {(data.workers ?? []).length === 0 ? <p className="text-xs nova-muted">No worker heartbeat recorded.</p> : (
            <ul className="bv-admin-detail-list">
              {data.workers.map((worker) => (
                <li key={worker.workerId}>
                  <span><strong>{worker.queue}</strong><small>{worker.hostname ?? 'Unknown host'} · {formatDateTime(worker.lastSeenAt, locale)}</small>
                    <small>Processed {worker.processedCount} / Failed {worker.failedCount}</small></span>
                  <StatusPill status={worker.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
