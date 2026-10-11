'use client';

import { useState } from 'react';
import { Card, DataTable, ErrorNote, Pagination, Skeleton } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';

/**
 * Generic admin list view: server-side pagination + filters + row actions, driven by a
 * column config. Every admin page uses this so pagination, empty states and error
 * handling behave identically everywhere.
 */
export function AdminTable<T>({
  endpoint, columns, rowKey, filters, pageSize = 25, onRowClick, empty = 'Nothing found.',
}: {
  endpoint: string;
  columns: { key: string; header: string; render?: (row: T) => React.ReactNode; className?: string }[];
  rowKey: (row: T) => string;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  empty?: string;
}) {
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const [key, value] of Object.entries(filterValues)) if (value) query.set(key, value);
  const { data, loading, error, reload } = useApiQuery<{ items: T[]; total: number }>(`${endpoint}?${query.toString()}`, { pollMs: 0 });

  return (
    <div>
      {filters && filters.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <select
              key={filter.key} className="nova-input !w-auto !py-1.5 text-xs" value={filterValues[filter.key] ?? ''}
              onChange={(event) => { setPage(1); setFilterValues({ ...filterValues, [filter.key]: event.target.value }); }}
              aria-label={filter.label}
            >
              <option value="">{filter.label}</option>
              {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ))}
          <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void reload()}>Refresh</button>
        </div>
      ) : (
        <div className="mb-3 flex justify-end">
          <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void reload()}>Refresh</button>
        </div>
      )}

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel="Retry" />
      {loading && !data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="!p-0">
          <DataTable<T> columns={columns} rows={data?.items ?? []} rowKey={rowKey} empty={empty} onRowClick={onRowClick} />
        </Card>
      )}
      <Pagination page={page} total={data?.total ?? 0} pageSize={pageSize} onChange={setPage} labels={{ prev: 'Previous', next: 'Next' }} />
    </div>
  );
}

/** Inline action button that performs a mutation and reports the outcome honestly. */
export function AdminAction({ label, onRun, tone = 'ghost', confirmText }: {
  label: string; onRun: () => Promise<unknown>; tone?: 'ghost' | 'primary' | 'danger'; confirmText?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const className = tone === 'primary' ? 'nova-btn-primary' : tone === 'danger' ? 'nova-btn-danger' : 'nova-btn-ghost';
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button" className={`${className} !px-2.5 !py-1 text-xs`} disabled={busy}
        onClick={async () => {
          if (confirmText && !window.confirm(confirmText)) return;
          setBusy(true);
          setMessage(null);
          try {
            await onRun();
            setMessage('ok');
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? '…' : label}
      </button>
      {message ? <span className={`text-[10px] ${message === 'ok' ? 'text-nova-primary' : 'text-nova-danger'}`}>{message}</span> : null}
    </span>
  );
}

export const adminPost = (path: string, json?: unknown, idempotencyKey?: string) =>
  apiRequest(path, { method: 'POST', json, idempotencyKey: idempotencyKey ?? crypto.randomUUID() });
