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
}

export function ReportsClient() {
  const { t, locale } = useApp();
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const { data, loading, error, reload } = useApiQuery<{ metrics: Metrics }>(`/api/v1/admin/dashboard?window=${range}`);

  const download = (kind: 'metrics' | 'audit') => {
    const href = kind === 'metrics' ? `/api/v1/admin/dashboard?window=${range}` : '/api/v1/admin/audit?pageSize=200';
    window.open(href, '_blank');
  };

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error && !data) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const m = data!.metrics;
  const netCash = BigInt(m.wallet.deposits24hMinor) - BigInt(m.wallet.withdrawals24hMinor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['24h', '7d', '30d'] as const).map((option) => (
          <button key={option} type="button" className={`nova-tab ${range === option ? 'nova-tab-active' : ''}`} onClick={() => setRange(option)}>{option}</button>
        ))}
        <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => download('metrics')}>View metrics JSON</button>
        <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => download('audit')}>View audit JSON</button>
        <span className="ms-auto text-xs nova-muted">Generated {formatDateTime(m.generatedAt, locale)}</span>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">Financial summary</h2>
        <table className="nova-table">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td className="text-xs">Stake</td><td>{formatMinor(m.betting.stake24hMinor, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Payout</td><td>{formatMinor(m.betting.payout24hMinor, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Gross gaming revenue</td><td>{formatMinor(m.betting.ggr24hMinor, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Deposits</td><td>{formatMinor(m.wallet.deposits24hMinor, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Withdrawals</td><td>{formatMinor(m.wallet.withdrawals24hMinor, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Net cash movement</td><td className={netCash >= 0n ? 'text-nova-primary' : 'text-nova-danger'}>{formatMinor(netCash, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Customer balance liability</td><td>{formatMinor(m.wallet.totalLiabilityMinor, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Open bet liability</td><td>{formatMinor(m.betting.openLiabilityMinor, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Affiliate commission</td><td>{formatMinor(m.affiliate.commission24hMinor, 'USD', locale)}</td></tr>
            <tr><td className="text-xs">Affiliate payable (all time)</td><td>{formatMinor(m.affiliate.payableMinor, 'USD', locale)}</td></tr>
          </tbody>
        </table>
        <p className="mt-2 text-[11px] nova-muted">
          All figures are calculated on request from the ledger and settlement tables; they are neither cached nor estimated.
          CSV export is available from the database reports view; the JSON above is the raw API payload.
        </p>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Bets" value={m.betting.bets24h} />
        <Stat label="Active customers" value={m.users.active24h} />
        <Stat label="New customers" value={m.users.new24h} />
        <Stat label="Verified users" value={m.users.verified} />
        <Stat label="Open bets" value={m.betting.openBets} />
        <Stat label="Pending withdrawals" value={m.wallet.pendingWithdrawals} tone={m.wallet.pendingWithdrawals > 0 ? 'warning' : undefined} />
        <Stat label="Affiliate payouts pending" value={m.affiliate.pendingPayouts} />
        <Stat label="Settlement backlog" value={m.risk.settlementBacklog} tone={m.risk.settlementBacklog > 0 ? 'warning' : undefined} />
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">Control status</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-2">Failed webhooks: <StatusPill status={m.risk.failedWebhooks24h === 0 ? 'ok' : 'warning'} /> {m.risk.failedWebhooks24h}</span>
          <span className="flex items-center gap-2">Manual review bets: <StatusPill status={m.risk.manualReviewBets === 0 ? 'ok' : 'warning'} /> {m.risk.manualReviewBets}</span>
          <span className="flex items-center gap-2">Flagged affiliates: <StatusPill status={m.risk.flaggedUsers === 0 ? 'ok' : 'warning'} /> {m.risk.flaggedUsers}</span>
        </div>
      </Card>
    </div>
  );
}
