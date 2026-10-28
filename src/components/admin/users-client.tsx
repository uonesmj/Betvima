'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, DataTable, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface AdminUser {
  id: string; publicId: string; numericId: number; email: string | null; phone: string | null; username: string | null;
  status: string; role: string; kycStatus: string;
  balanceSummary: { currency: string; balanceMinor: string }[];
  totalStakeMinor: string | null; totalPayoutMinor: string | null; netResultMinor: string | null; usdBalanceMinor: string | null; openBets: number;
  riskScore: number | null; registeredAt: string; lastLoginAt: string | null;
}

const STATUSES = ['active', 'restricted', 'suspended', 'closed', 'self_excluded'];
const KYC = ['not_started', 'pending', 'verified', 'rejected', 'expired'];

export function UsersClient() {
  const { t, locale } = useApp();
  const router = useRouter();
  const [filters, setFilters] = useState({ q: '', status: '', role: '', kyc: '', page: 1 });
  const query = new URLSearchParams({ page: String(filters.page), pageSize: '25' });
  for (const key of ['q', 'status', 'role', 'kyc'] as const) if (filters[key]) query.set(key, filters[key]);
  const { data, loading, error, reload } = useApiQuery<{ items: AdminUser[]; total: number }>(`/api/v1/admin/users?${query.toString()}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="nova-input !w-auto flex-1 sm:max-w-xs" placeholder="جست‌وجو با شناسه عددی (مثل 1100)، ایمیل یا نام کاربر"
          value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })}
        />
        <select className="nova-input !w-auto !py-1.5 text-xs" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">All statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select className="nova-input !w-auto !py-1.5 text-xs" value={filters.kyc} onChange={(e) => setFilters({ ...filters, kyc: e.target.value, page: 1 })}>
          <option value="">Any KYC</option>
          {KYC.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <Link href="/admin/casino-approvals" className="nova-btn-primary !py-1.5 text-xs">Casino approvals</Link>
        <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void reload()}>Refresh</button>
      </div>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-64 w-full" /> : (
        <Card className="!p-0">
          <DataTable<AdminUser>
            rows={data?.items ?? []}
            rowKey={(row) => row.id}
            empty="No customers match these filters."
            onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
            columns={[
              { key: 'id', header: 'شناسه کاربر', render: (row) => <span className="font-mono text-sm font-semibold" dir="ltr">{row.numericId}</span> },
              { key: 'contact', header: 'Email / phone', render: (row) => <span className="text-xs">{row.email ?? row.phone ?? '—'}</span> },
              { key: 'status', header: t('common.status'), render: (row) => <StatusPill status={row.status} /> },
              { key: 'kyc', header: 'KYC', render: (row) => <StatusPill status={row.kycStatus} /> },
              { key: 'role', header: 'Role', render: (row) => <span className="text-xs nova-muted">{row.role}</span> },
              {
                key: 'balance', header: 'Balance',
                render: (row) => (
                  <span className="whitespace-nowrap text-xs">
                    {row.balanceSummary?.length
                      ? row.usdBalanceMinor !== null
                        ? formatMinor(row.usdBalanceMinor, 'USD', locale)
                        : row.balanceSummary.map((b) => formatMinor(b.balanceMinor, b.currency, locale)).join(' · ')
                      : '—'}
                  </span>
                ),
              },
              { key: 'stake', header: 'Stake', render: (row) => <span className="whitespace-nowrap text-xs">{row.totalStakeMinor === null ? '— (no FX)' : formatMinor(row.totalStakeMinor, 'USD', locale)}</span> },
              {
                key: 'net', header: 'Net result',
                render: (row) => (
                  <span className={`whitespace-nowrap text-xs ${row.netResultMinor !== null && BigInt(row.netResultMinor) >= 0n ? 'text-nova-danger' : 'text-nova-primary'}`}>
                    {row.netResultMinor === null ? '— (no FX)' : formatMinor(row.netResultMinor, 'USD', locale)}
                  </span>
                ),
              },
              { key: 'open', header: 'Open bets', render: (row) => <span className="text-xs">{row.openBets}</span> },
              { key: 'registered', header: 'Registered', render: (row) => <span className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.registeredAt, locale)}</span> },
            ]}
          />
        </Card>
      )}
      <p className="text-xs nova-muted">{data?.total ?? 0} customers</p>
    </div>
  );
}
