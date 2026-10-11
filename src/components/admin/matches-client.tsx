'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, DataTable, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface MatchRow {
  id: string; sportKey: string; leagueName: string | null; status: string; scheduledAt: string;
  homeScore: number | null; awayScore: number | null; isLive: boolean; isBettingAvailable: boolean;
  participants: { role: string; name: string }[];
  marketsCount?: number; provider?: string | null;
}

export function MatchesClient() {
  const { t, locale } = useApp();
  const router = useRouter();
  const [filters, setFilters] = useState({ q: '', sport: '', live: false, page: 1 });
  const query = new URLSearchParams({ page: String(filters.page), pageSize: '25' });
  if (filters.q) query.set('q', filters.q);
  if (filters.sport) query.set('sport', filters.sport);
  if (filters.live) query.set('live', 'true');
  const { data, loading, error, reload } = useApiQuery<{ items: MatchRow[]; total: number }>(`/api/v1/matches?${query.toString()}`, { pollMs: 60_000 });

  const score = (match: MatchRow) => (
    match.homeScore === null && match.awayScore === null
      ? '—'
      : `${match.homeScore ?? '-'} : ${match.awayScore ?? '-'}`
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="nova-input !w-auto flex-1 sm:max-w-xs" placeholder="Search team or league"
          value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })}
        />
        <select className="nova-input !w-auto !py-1.5 text-xs" value={filters.sport} onChange={(e) => setFilters({ ...filters, sport: e.target.value, page: 1 })}>
          <option value="">All sports</option>
          {['football', 'basketball', 'tennis', 'volleyball', 'handball', 'hockey', 'esports', 'mma', 'other'].map((sport) => (
            <option key={sport} value={sport}>{sport}</option>
          ))}
        </select>
        <button type="button" className={`nova-tab ${filters.live ? 'nova-tab-active' : ''}`} onClick={() => setFilters({ ...filters, live: !filters.live, page: 1 })}>Live only</button>
        <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void reload()}>Refresh</button>
      </div>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-64 w-full" /> : (
        <Card className="!p-0">
          <DataTable<MatchRow>
            rows={data?.items ?? []}
            rowKey={(row) => row.id}
            empty="No matches. With no sports provider configured, matches must be created by an operator or imported from a provider feed."
            onRowClick={(row) => router.push(`/admin/matches/${row.id}`)}
            columns={[
              { key: 'kickoff', header: 'Kick-off', render: (row) => <span className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.scheduledAt, locale)}</span> },
              { key: 'league', header: 'League', render: (row) => <span className="text-xs">{row.leagueName ?? '—'}<span className="nova-muted"> · {row.sportKey}</span></span> },
              { key: 'match', header: 'Match', render: (row) => <span className="text-xs">{row.participants?.map((p) => p.name).join(' vs ') ?? '—'}</span> },
              { key: 'score', header: 'Score', render: (row) => <span className="text-xs">{score(row)}</span> },
              { key: 'status', header: t('common.status'), render: (row) => <StatusPill status={row.status} /> },
              { key: 'betting', header: 'Betting', render: (row) => <StatusPill status={row.isBettingAvailable ? 'available' : 'suspended'} /> },
              { key: 'markets', header: 'Markets', render: (row) => <span className="text-xs">{row.marketsCount ?? '—'}</span> },
            ]}
          />
        </Card>
      )}
      <p className="text-xs nova-muted">{data?.total ?? 0} matches</p>
    </div>
  );
}
