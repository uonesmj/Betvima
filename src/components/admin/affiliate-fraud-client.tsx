'use client';

import { useState } from 'react';
import { AdminAction } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Field, Skeleton, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface FlagRow {
  id: string; affiliate_id: string; affiliate_code: string; user_id: string | null; user_email: string | null;
  kind: string; severity: string; status: string; detail: string | null; created_at: string; resolved_at: string | null;
}

export function AffiliateFraudClient() {
  const { t, locale } = useApp();
  const [status, setStatus] = useState('open');
  const { data, loading, error, reload } = useApiQuery<{ items: FlagRow[] }>(`/api/v1/admin/affiliates/fraud?status=${status}`);
  const [resolution, setResolution] = useState('');

  const resolve = async (flag: FlagRow, next: string) => {
    await apiRequest('/api/v1/admin/affiliates/fraud', {
      method: 'PATCH',
      json: { flagId: flag.id, status: next, resolution: resolution.length >= 8 ? resolution : `reviewed by operator (${next})` },
    });
    await reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {['open', 'reviewing', 'confirmed', 'dismissed'].map((option) => (
          <button key={option} type="button" className={`nova-tab ${status === option ? 'nova-tab-active' : ''}`} onClick={() => setStatus(option)}>{option}</button>
        ))}
      </div>

      <Card>
        <Field label="Resolution note (min 8 characters, stored on the flag)">
          <input className="nova-input" value={resolution} onChange={(event) => setResolution(event.target.value)} />
        </Field>
        <p className="mt-2 text-[11px] nova-muted">
          Flags never move money on their own: confirming a flag marks it for the affiliate team, and any commission
          recovery is a separate, audited ledger adjustment.
        </p>
      </Card>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="!p-0">
          <table className="nova-table">
            <thead><tr><th>Created</th><th>Affiliate</th><th>Type</th><th>Severity</th><th>Details</th><th>User</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.items ?? []).map((flag) => (
                <tr key={flag.id}>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(flag.created_at, locale)}</td>
                  <td className="font-mono text-xs">{flag.affiliate_code}</td>
                  <td className="text-xs">{flag.kind}</td>
                  <td><StatusPill status={flag.severity} /></td>
                  <td className="max-w-[28ch] truncate text-xs nova-muted" title={flag.detail ?? ''}>{flag.detail ?? '—'}</td>
                  <td className="font-mono text-[11px] nova-muted">{flag.user_email ?? (flag.user_id ? flag.user_id.slice(0, 8) : '—')}</td>
                  <td><StatusPill status={flag.status} /></td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      <AdminAction label="Reviewing" onRun={() => resolve(flag, 'reviewing')} />
                      <AdminAction label="Confirm" tone="danger" confirmText="این مورد تقلب Confirm شود؟" onRun={() => resolve(flag, 'confirmed')} />
                      <AdminAction label="Dismiss" onRun={() => resolve(flag, 'dismissed')} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.items.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted" >No items exist in this status.</p> : null}
        </Card>
      )}
    </div>
  );
}
