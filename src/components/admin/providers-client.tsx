'use client';

import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface ProviderStatus {
  provider: string; category: 'sports' | 'payments' | 'notifications' | string;
  configured: boolean; enabled: boolean; reachable: boolean | null;
  lastSuccessAt: string | null; lastErrorAt: string | null; lastError: string | null;
  requiredEnv: string[]; notes: string | null;
}
interface HealthRow {
  provider: string; kind: string; status: string; last_success_at: string | null; last_error_at: string | null;
  last_error: string | null; consecutive_failures: number; latency_ms: number | null; updated_at: string;
}

export function ProvidersClient() {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ statuses: ProviderStatus[]; health: HealthRow[] }>('/api/v1/admin/providers', { pollMs: 60_000 });

  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  if (error && !data) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold">Configured integrations</h2>
        <table className="nova-table">
          <thead><tr><th>Category</th><th>Provider</th><th>Configured</th><th>Enabled</th><th>Reachable</th><th>Required env</th><th>Notes</th></tr></thead>
          <tbody>
            {(data?.statuses ?? []).map((status) => (
              <tr key={`${status.category}-${status.provider}`}>
                <td className="text-xs">{status.category}</td>
                <td className="text-xs">{status.provider}</td>
                <td><StatusPill status={status.configured ? 'ok' : 'disabled'} /></td>
                <td><StatusPill status={status.enabled ? 'active' : 'disabled'} /></td>
                <td><StatusPill status={status.reachable === null ? 'unknown' : status.reachable ? 'ok' : 'down'} /></td>
                <td className="text-[11px] nova-muted">{status.requiredEnv?.join(', ')}</td>
                <td className="text-[11px] nova-muted">{status.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] nova-muted">
          Nothing is faked: with a provider disabled the platform returns NOT_CONFIGURED and keeps money and odds untouched.
          Add the environment variables and restart the server/workers to activate an integration.
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">Provider health log</h2>
        {(data?.health ?? []).length === 0 ? (
          <EmptyState title="No provider calls recorded" hint="Health rows appear after the first odds sync, payment call or notification attempt." />
        ) : (
          <table className="nova-table">
            <thead><tr><th>Type</th><th>Provider</th><th>Status</th><th>Errors</th><th>Latency</th><th>Last success</th><th>Last error</th></tr></thead>
            <tbody>
              {data!.health.map((row) => (
                <tr key={`${row.kind}-${row.provider}`}>
                  <td className="text-xs">{row.kind}</td>
                  <td className="text-xs">{row.provider}</td>
                  <td><StatusPill status={row.status} /></td>
                  <td className="text-xs">{row.consecutive_failures}</td>
                  <td className="text-xs nova-muted">{row.latency_ms === null ? '—' : `${row.latency_ms} ms`}</td>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.last_success_at, locale)}</td>
                  <td className="text-[11px] text-nova-danger">{row.last_error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
