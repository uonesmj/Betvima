'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, DataTable, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface AffiliateRow {
  id: string; publicId: string; code: string; displayName: string; status: string;
  commissionModel: string; commissionRateBps: number; currency: string;
  payableMinor: string; carryForwardMinor: string; suppressedMinor: string; usdPayableMinor: string; usdCarryForwardMinor: string; usdSuppressedMinor: string;
  lifetimeCommissionMinor: string; lifetimePaidMinor: string; depth: number;
  riskScore: number; isFraudFlagged: boolean; createdAt: string; parentAffiliateId: string | null;
}

export function AffiliatesClient() {
  const { t, locale } = useApp();
  const router = useRouter();
  const [filters, setFilters] = useState({ q: '', status: '', model: '', flagged: false, page: 1 });
  const query = new URLSearchParams({ page: String(filters.page), pageSize: '25' });
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.model) query.set('model', filters.model);
  if (filters.flagged) query.set('flagged', 'true');
  const { data, loading, error, reload } = useApiQuery<{ items: AffiliateRow[]; total: number }>(`/api/v1/admin/affiliates?${query.toString()}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="nova-input !w-auto flex-1 sm:max-w-xs" placeholder="Search code, name or email"
          value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })}
        />
        <select className="nova-input !w-auto !py-1.5 text-xs" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">Any status</option>
          {['pending', 'approved', 'suspended', 'blocked', 'closed'].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select className="nova-input !w-auto !py-1.5 text-xs" value={filters.model} onChange={(e) => setFilters({ ...filters, model: e.target.value, page: 1 })}>
          <option value="">Any model</option>
          {['PROFIT_LOSS_35', 'NON_NEGATIVE_35', 'CPA', 'HYBRID'].map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
        <button type="button" className={`nova-tab ${filters.flagged ? 'nova-tab-active' : ''}`} onClick={() => setFilters({ ...filters, flagged: !filters.flagged, page: 1 })}>Flagged only</button>
        <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void reload()}>Refresh</button>
      </div>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-64 w-full" /> : (
        <Card className="!p-0">
          <DataTable<AffiliateRow>
            rows={data?.items ?? []}
            rowKey={(row) => row.id}
            empty="No affiliates match these filters."
            onRowClick={(row) => router.push(`/admin/affiliates/${row.id}`)}
            columns={[
              { key: 'code', header: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
              { key: 'name', header: 'Name', render: (row) => <span className="text-xs">{row.displayName}</span> },
              { key: 'status', header: t('common.status'), render: (row) => <StatusPill status={row.status} /> },
              {
                key: 'terms', header: 'Terms',
                render: (row) => <span className="text-xs">{row.commissionModel}<span className="nova-muted"> · {(row.commissionRateBps / 100).toFixed(1)}%</span></span>,
              },
              { key: 'depth', header: 'Depth', render: (row) => <span className="text-xs">{row.depth}</span> },
              {
                key: 'payable', header: 'Payable',
                render: (row) => <span className="whitespace-nowrap text-xs">{formatMinor(row.usdPayableMinor, 'USD', locale)}</span>,
              },
              {
                key: 'carry', header: 'Carry-forward',
                render: (row) => (
                  <span className={`whitespace-nowrap text-xs ${BigInt(row.usdCarryForwardMinor) < 0n ? 'text-nova-danger' : 'nova-muted'}`}>
                    {formatMinor(row.usdCarryForwardMinor, 'USD', locale)}
                  </span>
                ),
              },
              {
                key: 'suppressed', header: 'Suppressed',
                render: (row) => <span className="whitespace-nowrap text-xs nova-muted">{formatMinor(row.usdSuppressedMinor, 'USD', locale)}</span>,
              },
              { key: 'risk', header: 'Risk', render: (row) => <StatusPill status={row.isFraudFlagged ? 'flagged' : row.riskScore >= 50 ? 'warning' : 'ok'} /> },
              { key: 'created', header: 'Joined', render: (row) => <span className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.createdAt, locale)}</span> },
            ]}
          />
        </Card>
      )}
      <p className="text-xs nova-muted">{data?.total ?? 0} affiliates</p>
    </div>
  );
}
