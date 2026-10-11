'use client';

import { useState } from 'react';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, DataTable, ErrorNote, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface JobStat { queue: string; pending: number; running: number; failed: number; dead: number; oldestPendingSeconds: number | null }
interface Job {
  id: string; queue: string; kind: string; status: string; attempts: number; maxAttempts: number;
  runAfter: string; lastError: string | null; lockedBy: string | null; updatedAt?: string; createdAt?: string;
  jobKey?: string | null;
}
interface Heartbeat { workerId: string; queue: string; status: string; lastSeenAt: string; processedCount: number; failedCount: number; hostname: string | null; version: string | null; currentJobId: string | null }

export function WorkersClient() {
  const { t, locale } = useApp();
  const [status, setStatus] = useState('');
  const query = new URLSearchParams({ pageSize: '50' });
  if (status) query.set('status', status);
  const { data, loading, error, reload } = useApiQuery<{ stats: JobStat[]; items: Job[]; total: number; heartbeats?: Heartbeat[] }>(
    `/api/v1/admin/jobs?${query.toString()}`, { pollMs: 30_000 },
  );
  const workers = useApiQuery<{ heartbeats: Heartbeat[] }>('/api/v1/admin/workers', { pollMs: 30_000 });

  return (
    <div className="space-y-4">
      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.stats ?? []).slice(0, 4).map((stat) => (
          <Stat key={stat.queue} label={`${stat.queue} · queued`} value={stat.pending} tone={stat.dead > 0 ? 'danger' : stat.failed > 0 ? 'warning' : undefined} />
        ))}
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">Worker heartbeats</h2>
        {(workers.data?.heartbeats ?? []).length === 0 ? (
          <p className="text-xs nova-muted">
            No worker has reported yet. Start one with <code className="nova-chip">npm run worker:settlement</code> (and the
            other three) — jobs stay queued until a worker claims them.
          </p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {workers.data!.heartbeats.map((heartbeat) => (
              <li key={`${heartbeat.workerId}-${heartbeat.queue}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-nova-line/50 pb-1.5">
                <span className="font-mono">{heartbeat.workerId.slice(0, 12)}</span>
                <span>{heartbeat.queue}</span>
                <span className="nova-muted">{heartbeat.hostname ?? ''} · {formatDateTime(heartbeat.lastSeenAt, locale)} · ok {heartbeat.processedCount} / fail {heartbeat.failedCount}</span>
                <StatusPill status={heartbeat.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {['', 'queued', 'processing', 'failed', 'succeeded', 'dead'].map((option) => (
          <button key={option || 'all'} type="button" className={`nova-tab ${status === option ? 'nova-tab-active' : ''}`} onClick={() => setStatus(option)}>
            {option || 'all'}
          </button>
        ))}
      </div>

      {loading && !data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="!p-0">
          <DataTable<Job>
            rows={data?.items ?? []}
            rowKey={(row) => row.id}
            empty="No jobs in this state."
            columns={[
              { key: 'queue', header: 'Queue', render: (row) => <span className="text-xs">{row.queue}</span> },
              { key: 'kind', header: 'Kind', render: (row) => <span className="text-xs">{row.kind}</span> },
              { key: 'status', header: t('common.status'), render: (row) => <StatusPill status={row.status} /> },
              { key: 'attempts', header: 'Attempts', render: (row) => <span className="text-xs">{row.attempts}/{row.maxAttempts}</span> },
              { key: 'runAfter', header: 'Run after', render: (row) => <span className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.runAfter, locale)}</span> },
              { key: 'error', header: 'Last error', render: (row) => <span className="text-[11px] text-nova-danger">{row.lastError ?? '—'}</span> },
              {
                key: 'actions', header: '',
                render: (row) => (
                  <span className="flex gap-1">
                    <AdminAction label="Retry" onRun={async () => { await adminPost(`/api/v1/admin/jobs/${row.id}/retry`); await reload(); }} />
                    <AdminAction label="Cancel" tone="danger" confirmText="Cancel this job?" onRun={async () => { await adminPost(`/api/v1/admin/jobs/${row.id}/cancel`); await reload(); }} />
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
