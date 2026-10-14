'use client';

import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useApp } from '@/components/layout/providers';
import { Card, DataTable, EmptyState, ErrorNote, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Referral {
  userId: string; code: string; status: string; confirmedAt: string | null;
  wageredMinor: string; netRevenueMinor: string; commissionMinor: string; depositMinor: string; withdrawalMinor: string; panelShareMinor: string;
}

export function AffiliateReferralsClient() {
  const { t, locale, session } = useApp();
  const tr = (value: string | undefined) => { const copy = value ?? ''; return locale === 'fa' ? translateVisibleText(copy) : copy; };
  const { data, loading, error, reload } = useApiQuery<{ items: Referral[]; total: number; fraud: { riskScore: number; signals: { kind: string; detail: string; severity: string }[] } }>(
    session?.authenticated ? '/api/v1/affiliate/referrals' : null,
  );

  if (!session?.authenticated) return <EmptyState title={t('nav.login')} />;
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  return (
    <div className="affiliate-referrals-v2 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Referrals" value={data?.total ?? 0} />
        <Stat label="Risk score" value={data?.fraud.riskScore ?? 0} tone={(data?.fraud.riskScore ?? 0) >= 80 ? 'danger' : (data?.fraud.riskScore ?? 0) >= 50 ? 'warning' : undefined} />
        <Stat label="Signals" value={data?.fraud.signals.length ?? 0} />
      </div>

      {(data?.items.length ?? 0) === 0 ? (
        <Card className="referral-empty-card overflow-hidden !p-0">
          <div className="referral-empty-hero relative overflow-hidden bg-[#071A31] px-5 py-7 text-white sm:px-7">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#087FF5]/20 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-xl font-black">↗</div>
              <div className="text-[10px] font-black uppercase tracking-[.18em] text-[#8FA7C2]">{tr("Referral network")}</div>
              <h2 className="mt-1 text-xl font-black">{tr("Start building your network")}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#B9C9DA]">
                {tr("Share your referral link and bring new players to NOVA. Your commission is calculated from the referred players’ settled profit and loss.")}
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#8FA7C2]">{tr("Commission")}</div>
                  <div className="mt-1 text-lg font-black">70%</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#8FA7C2]">{tr("Settlement")}</div>
                  <div className="mt-1 text-lg font-black">{tr("USD")}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#8FA7C2]">{tr("Minimum payout")}</div>
                  <div className="mt-1 text-lg font-black">$40</div>
                </div>
              </div>
            </div>
          </div>
          <div className="referral-empty-bottom flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <div className="text-sm font-bold text-[#172033]">{tr("No referred players yet")}</div>
              <p className="mt-1 text-xs text-[#718096]">{tr("Create a campaign link and start sharing it with your audience.")}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a href="/affiliate/links" className="nova-btn-primary text-center">{tr("Create referral link")}</a>
              <a href="/affiliate/dashboard" className="nova-btn-ghost text-center">{tr("Back to dashboard")}</a>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <DataTable<Referral>
            rows={data!.items}
            rowKey={(row) => row.userId}
            empty={t('affiliate.noReferrals')}
            columns={[
              { key: 'user', header: 'User', render: (row) => <span className="font-mono text-xs">{row.userId.slice(0, 8)}</span> },
              { key: 'code', header: 'Code', render: (row) => row.code },
              { key: 'status', header: t('common.status'), render: (row) => <StatusPill status={row.status} /> },
              { key: 'confirmed', header: 'Confirmed', render: (row) => <span className="text-xs nova-muted">{formatDateTime(row.confirmedAt, locale)}</span> },
              { key: 'deposit', header: 'Deposit', render: (row) => formatMinor(row.depositMinor, 'USD', locale) },
              { key: 'withdrawal', header: 'Withdrawal', render: (row) => formatMinor(row.withdrawalMinor, 'USD', locale) },
              { key: 'wagered', header: 'Turnover', render: (row) => formatMinor(row.wageredMinor, 'USD', locale) },
              { key: 'net', header: 'Player P/L', render: (row) => {
                const value = formatMinor(row.netRevenueMinor, 'USD', locale);
                const positive = BigInt(row.netRevenueMinor || '0') > 0n;
                const negative = BigInt(row.netRevenueMinor || '0') < 0n;
                return <span className={positive ? 'text-red-600' : negative ? 'text-emerald-600' : 'text-[#111827]'}>{value}</span>;
              } },
              { key: 'panel', header: 'Your 70%', render: (row) => {
                const value = formatMinor(row.panelShareMinor, 'USD', locale);
                const positive = BigInt(row.panelShareMinor || '0') > 0n;
                const negative = BigInt(row.panelShareMinor || '0') < 0n;
                return <span className={positive ? 'text-emerald-600' : negative ? 'text-red-600' : 'text-[#111827]'}>{value}</span>;
              } },
              { key: 'commission', header: 'Commission', render: (row) => <span className="text-nova-primary">{formatMinor(row.commissionMinor, 'USD', locale)}</span> },
            ]}
          />
        </Card>
      )}

      {(data?.fraud.signals.length ?? 0) > 0 ? (
        <Card className="fraud-panel">
          <h3 className="mb-2 text-sm font-semibold">{tr("Fraud signals")}</h3>
          <ul className="space-y-1 text-xs">
            {data!.fraud.signals.map((signal) => (
              <li key={`${signal.kind}-${signal.detail}`} className="flex items-center justify-between gap-2 border-b border-nova-line/50 pb-1">
                <span>{signal.kind} — <span className="nova-muted">{signal.detail}</span></span>
                <StatusPill status={signal.severity} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] nova-muted">
            {tr("Flags are reviewed by the affiliate team. Commission is never confiscated automatically.")}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
