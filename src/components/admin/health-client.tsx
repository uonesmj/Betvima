'use client';

import { Card, ErrorNote, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useApp } from '@/components/layout/providers';
import { formatDateTime } from '@/lib/i18n';

interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  version: string; environment: string; uptimeSeconds: number; checkedAt: string; durationMs: number;
  checks: { name: string; status: string; latencyMs: number | null; message: string | null; critical: boolean; checkedAt: string }[];
  config?: { providers?: Record<string, string>; flags?: Record<string, boolean> };
}

export function HealthClient() {
  const { t, locale } = useApp();
  const ready = useApiQuery<HealthReport>('/api/health/ready', { pollMs: 30_000 });
  const live = useApiQuery<HealthReport>('/api/health', { pollMs: 30_000 });

  if (live.loading && !live.data) return <Skeleton className="h-48 w-full" />;

  const report = live.data;
  return (
    <div className="space-y-4">
      <ErrorNote message={ready.error} onRetry={() => void ready.reload()} retryLabel={t('common.retry')} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Overall" value={<StatusPill status={report?.status ?? 'unknown'} />} />
        <Stat label="Readiness" value={<StatusPill status={ready.data?.status ?? 'unknown'} />} />
        <Stat label="Uptime" value={`${Math.round((report?.uptimeSeconds ?? 0) / 60)} min`} />
        <Stat label="Version" value={`${report?.version ?? '—'} (${report?.environment ?? '—'})`} />
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">Dependency checks</h2>
        <table className="nova-table">
          <thead><tr><th>Check</th><th>Status</th><th>Latency</th><th>Details</th><th>Check time</th></tr></thead>
          <tbody>
            {(report?.checks ?? []).map((check) => (
              <tr key={check.name}>
                <td>{check.name}{check.critical ? <span className="ms-1 text-[10px] nova-muted">critical</span> : null}</td>
                <td><StatusPill status={check.status} /></td>
                <td className="text-xs nova-muted">{check.latencyMs === null ? '—' : `${check.latencyMs} ms`}</td>
                <td className="text-xs">{check.message ?? '—'}</td>
                <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(check.checkedAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] nova-muted">
          A degraded state is reported honestly: unavailable providers show as degraded, never as healthy.
        </p>
      </Card>
    </div>
  );
}
