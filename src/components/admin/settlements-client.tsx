'use client';

import Link from 'next/link';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface Job {
  id: string; queue: string; kind: string; status: string; attempts: number; maxAttempts: number;
  runAfter: string; lastError: string | null; betId?: string | null; matchId?: string | null;
}
interface Metrics { risk: { settlementBacklog: number; manualReviewBets: number }; betting: { openBets: number; openLiabilityMinor: string } }
/** nova.settlement_jobs rows - the authoritative queue the settlement worker consumes. */
interface SettlementJob {
  id: string; betId: string; userId: string; status: string; attempts: number;
  reason: string | null; createdAt: string; processedAt: string | null;
}
interface QueueStats { queued: number; processing: number; done: number; failed: number; manual_review: number; skipped: number }

export function SettlementsClient() {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ stats: { queue: string; pending: number; running: number; failed: number; dead: number; oldestPendingSeconds: number | null }[]; items: Job[]; total: number }>(
    '/api/v1/admin/jobs?pageSize=100', { pollMs: 30_000 },
  );
  const metrics = useApiQuery<{ metrics: Metrics }>('/api/v1/admin/dashboard?window=24h', { pollMs: 60_000 });
  // The settlement queue is the engine's own work list (not the generic job queue), so the two
  // are shown side by side: one is what the engine will settle, the other is what workers ran.
  const queue = useApiQuery<{ items: SettlementJob[]; total: number; stats: QueueStats }>(
    '/api/v1/admin/settlements?pageSize=50', { pollMs: 30_000 },
  );

  const settlementJobs = (data?.items ?? []).filter((job) => /settle|regrade|result/i.test(job.kind) || job.queue === 'settlement');
  const byKind = (data?.stats ?? []).filter((stat) => stat.queue === 'settlement');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Settlement backlog" value={metrics.data?.metrics.risk.settlementBacklog ?? 0} tone={(metrics.data?.metrics.risk.settlementBacklog ?? 0) > 0 ? 'warning' : undefined} />
        <Stat label="Manual review bets" value={metrics.data?.metrics.risk.manualReviewBets ?? 0} tone={(metrics.data?.metrics.risk.manualReviewBets ?? 0) > 0 ? 'warning' : undefined} />
        <Stat label="Open bets" value={metrics.data?.metrics.betting.openBets ?? 0} />
        <Stat label="تعهدات Open" value={metrics.data?.metrics.betting.openLiabilityMinor ?? '0'} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {byKind.map((stat) => <Stat key={stat.queue} label={`${stat.queue} · queued`} value={stat.pending} tone={stat.dead > 0 ? 'danger' : stat.failed > 0 ? 'warning' : undefined} />)}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(['queued', 'processing', 'manual_review', 'failed', 'done', 'skipped'] as const).map((key) => (
          <Stat
            key={key} label={`Queue · ${key}`} value={queue.data?.stats[key] ?? 0}
            tone={key === 'failed' ? 'danger' : key === 'manual_review' || key === 'queued' ? 'warning' : undefined}
          />
        ))}
      </div>

      <ErrorNote
        message={queue.error ?? error}
        onRetry={() => { void queue.reload(); void reload(); }}
        retryLabel={t('common.retry')}
      />

      <Card className="!p-0">
        <table className="nova-table">
          <thead><tr><th>Bet</th><th>Status</th><th>Attempts</th><th>Reason</th><th>Created</th><th>Processed</th></tr></thead>
          <tbody>
            {(queue.data?.items ?? []).map((job) => (
              <tr key={job.id}>
                <td className="font-mono text-[11px]"><Link href={`/admin/bets/${job.betId}`} className="underline">{job.betId.slice(0, 8)}</Link></td>
                <td><StatusPill status={job.status} /></td>
                <td className="text-xs">{job.attempts}</td>
                <td className="max-w-[22rem] truncate text-xs nova-muted" title={job.reason ?? ''}>{job.reason ?? '—'}</td>
                <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(job.createdAt, locale)}</td>
                <td className="whitespace-nowrap text-xs nova-muted">{job.processedAt ? formatDateTime(job.processedAt, locale) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {queue.data && queue.data.items.length === 0 ? (
          <p className="p-4 text-xs nova-muted">
            The settlement queue is empty. Rows appear when a result is recorded for a match with open bets, or when an
            operator requests a regrade.
          </p>
        ) : null}
      </Card>
      {loading && !data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="!p-0">
          <table className="nova-table">
            <thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Run after</th><th>Last error</th><th>Actions</th></tr></thead>
            <tbody>
              {settlementJobs.map((job) => (
                <tr key={job.id}>
                  <td className="text-xs">{job.kind}</td>
                  <td><StatusPill status={job.status} /></td>
                  <td className="text-xs">{job.attempts}/{job.maxAttempts}</td>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(job.runAfter, locale)}</td>
                  <td className="text-[11px] text-nova-danger">{job.lastError ?? '—'}</td>
                  <td>
                    <span className="flex gap-1">
                      <AdminAction label="Retry" onRun={async () => { await adminPost(`/api/v1/admin/jobs/${job.id}/retry`); await reload(); }} />
                      <AdminAction label="Cancel" tone="danger" onRun={async () => { await adminPost(`/api/v1/admin/jobs/${job.id}/cancel`); await reload(); }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {settlementJobs.length === 0 ? (
            <p className="p-4 text-xs nova-muted">
              No settlement jobs in the queue. Jobs appear when a result is recorded (operator or provider feed) or when a
              bet is placed on a match awaiting settlement.
            </p>
          ) : null}
        </Card>
      )}
    </div>
  );
}
