'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, DataTable, ErrorNote, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor, formatOddsScaled } from '@/lib/i18n';

interface BetRow {
  id: string; publicId: string; userId: string; type: string; status: string; currency: string;
  stakeMinor: string; potentialPayoutMinor: string; settledPayoutMinor: string | null; usdStakeMinor: string | null; usdPotentialPayoutMinor: string | null; usdSettledPayoutMinor: string | null; usdNetResultMinor: string | null;
  combinedOddsScaled: string; placedAt: string; settledAt: string | null;
  isLive: boolean; source: string; legs: { id: string; status: string; grade: string | null; selectionLabel: string; matchLabel: string }[];
}

const STATUSES = ['accepted', 'partially_settled', 'settled', 'void', 'cancelled', 'cashed_out', 'rejected', 'manual_review'];

export function BetsClient() {
  const { t, locale } = useApp();
  const router = useRouter();
  const [filters, setFilters] = useState({ q: '', status: '', type: '', page: 1 });
  const query = new URLSearchParams({ page: String(filters.page), pageSize: '25' });
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.type) query.set('type', filters.type);
  const { data, loading, error, reload } = useApiQuery<{ items: BetRow[]; total: number }>(`/api/v1/admin/bets?${query.toString()}`);

  const open = (data?.items ?? []).filter((bet) => bet.status === 'accepted' || bet.status === 'partially_settled');
  const staked = open.every((bet) => bet.usdStakeMinor !== null)
    ? open.reduce((total, bet) => total + BigInt(bet.usdStakeMinor!), 0n) : null;
  const liability = open.every((bet) => bet.usdPotentialPayoutMinor !== null)
    ? open.reduce((total, bet) => total + BigInt(bet.usdPotentialPayoutMinor!), 0n) : null;
  const showAmount = (usd: string | null, native: string, currency: string) =>
    usd !== null ? formatMinor(usd, 'USD', locale) : formatMinor(native, currency, locale);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Bets on page" value={data?.items.length ?? 0} />
        <Stat label="Open bet amount (page)" value={staked === null ? '— (non-USD)' : formatMinor(staked, 'USD', locale)} />
        <Stat label="Open liability (page)" value={liability === null ? '— (non-USD)' : formatMinor(liability, 'USD', locale)} tone="warning" />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="nova-input !w-auto flex-1 sm:max-w-xs" placeholder="Search by bet id, user, match or selection"
          value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })}
        />
        <select className="nova-input !w-auto !py-1.5 text-xs" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">Any status</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select className="nova-input !w-auto !py-1.5 text-xs" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}>
          <option value="">Any type</option>
          <option value="SINGLE">SINGLE</option>
          <option value="MULTIPLE">MULTIPLE</option>
        </select>
        <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void reload()}>Refresh</button>
      </div>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-64 w-full" /> : (
        <Card className="!p-0">
          <DataTable<BetRow>
            rows={data?.items ?? []}
            rowKey={(row) => row.id}
            empty="No bets match these filters."
            onRowClick={(row) => router.push(`/admin/bets/${row.id}`)}
            columns={[
              { key: 'id', header: 'Bet', render: (row) => <span className="font-mono text-xs">{row.publicId}</span> },
              { key: 'type', header: 'Type', render: (row) => <span className="text-xs">{row.type}{row.isLive ? ' · Live' : ''}</span> },
              { key: 'status', header: t('common.status'), render: (row) => <StatusPill status={row.status} /> },
              { key: 'legs', header: 'Legs', render: (row) => <span className="text-xs nova-muted">{row.legs?.length ?? 0}</span> },
              { key: 'odds', header: 'Odds', render: (row) => <span className="text-xs">{formatOddsScaled(row.combinedOddsScaled)}</span> },
              { key: 'stake', header: 'Stake', render: (row) => <span className="whitespace-nowrap text-xs">{showAmount(row.usdStakeMinor, row.stakeMinor, row.currency)}</span> },
              { key: 'potential', header: 'Potential', render: (row) => <span className="whitespace-nowrap text-xs">{showAmount(row.usdPotentialPayoutMinor, row.potentialPayoutMinor, row.currency)}</span> },
              {
                key: 'settled', header: 'Settled payout',
                render: (row) => (
                  <span className="whitespace-nowrap text-xs">
                    {row.usdSettledPayoutMinor === null ? '—' : showAmount(row.usdSettledPayoutMinor, row.settledPayoutMinor!, row.currency)}
                  </span>
                ),
              },
              { key: 'placed', header: 'Placed', render: (row) => <span className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.placedAt, locale)}</span> },
            ]}
          />
        </Card>
      )}
      <p className="text-xs nova-muted">{data?.total ?? 0} bets</p>
    </div>
  );
}
