'use client';

import { Fragment, useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface AuditEntry {
  id: string; actorId: string | null; actorEmail: string | null; actorRole: string | null; action: string;
  entityType: string; entityId: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null;
  reason: string | null; correlationId: string | null; createdAt: string;
}

export function AuditClient() {
  const { t, locale } = useApp();
  const [filters, setFilters] = useState({ q: '', entityType: '', page: 1 });
  const query = new URLSearchParams({ page: String(filters.page), pageSize: '50' });
  if (filters.q) query.set('q', filters.q);
  if (filters.entityType) query.set('entityType', filters.entityType);
  const { data, loading, error, reload } = useApiQuery<{ items: AuditEntry[]; total: number }>(`/api/v1/admin/audit?${query.toString()}`);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="nova-input !w-auto flex-1 sm:max-w-xs" placeholder="Search action, entity or id" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })} />
        <input className="nova-input !w-auto" placeholder="Entity type (bet, wallet, affiliate…)" value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value, page: 1 })} />
        <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void reload()}>Refresh</button>
      </div>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-64 w-full" /> : (
        <Card className="!p-0">
          <table className="nova-table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th><th>Correlation</th><th /></tr></thead>
            <tbody>
              {(data?.items ?? []).map((entry) => (
                <Fragment key={entry.id}>
                  <tr>
                    <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(entry.createdAt, locale)}</td>
                    <td className="text-xs">{entry.actorEmail ?? entry.actorId?.slice(0, 8) ?? 'system'}<div className="text-[10px] nova-muted">{entry.actorRole ?? ''}</div></td>
                    <td className="text-xs">{entry.action}</td>
                    <td className="text-xs nova-muted">{entry.entityType}{entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ''}</td>
                    <td className="max-w-[24ch] truncate text-xs nova-muted" title={entry.reason ?? ''}>{entry.reason ?? '—'}</td>
                    <td className="font-mono text-[10px] nova-muted">{entry.correlationId?.slice(0, 8) ?? '—'}</td>
                    <td>
                      <button type="button" className="nova-btn-ghost !px-2 !py-1 text-xs" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                        {expanded === entry.id ? 'Hide' : 'Difference'}
                      </button>
                    </td>
                  </tr>
                  {expanded === entry.id ? (
                    <tr>
                      <td colSpan={7} className="bg-nova-surface2">
                        <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                          <div>
                            <div className="nova-muted">Before</div>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap">{JSON.stringify(entry.before, null, 2) ?? 'null'}</pre>
                          </div>
                          <div>
                            <div className="nova-muted">After</div>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap">{JSON.stringify(entry.after, null, 2) ?? 'null'}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {(data?.items.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted">No audit entries.</p> : null}
        </Card>
      )}
      <p className="text-xs nova-muted">{data?.total ?? 0} entries · the audit log is append-only; entries are never edited or deleted.</p>
    </div>
  );
}
