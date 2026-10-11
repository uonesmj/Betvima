'use client';

import { useState } from 'react';
import { AdminAction } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Field, Skeleton, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface Operation { key: string; isEnabled: boolean; description?: string | null; updatedBy?: string | null; updatedAt?: string | null }
interface KillSwitch { key: string; isActive: boolean; reason: string | null; activatedBy: string | null; activatedAt: string | null; expiresAt: string | null }

export function OperationsClient() {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ operations: Operation[]; killSwitches: KillSwitch[]; maintenance: { enabled: boolean; message?: string | null } | null }>(
    '/api/v1/admin/operations', { pollMs: 30_000 },
  );
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const toggle = async (operation: Operation) => {
    setMessage(null);
    try {
      if (reason.trim().length < 4) throw new Error('a reason of at least 4 characters is required');
      await apiRequest('/api/v1/admin/operations', {
        method: 'PATCH', json: { key: operation.key, isEnabled: !operation.isEnabled, reason: reason.trim() },
      });
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'failed');
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <Field label="Reason for the change (required, audited)">
          <input className="nova-input" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {message ? <div className="mt-2 rounded-lg border border-nova-danger/40 bg-nova-danger/10 p-2 text-xs text-nova-danger">{message}</div> : null}
        <p className="mt-2 text-[11px] nova-muted">
          Switches are enforced inside the database functions (place_bet, payments, settlement, payouts), so disabling one
          takes effect immediately for every client and worker.
        </p>
      </Card>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-48 w-full" /> : (
        <>
          <Card className="!p-0">
            <table className="nova-table">
              <thead><tr><th>Operation</th><th>State</th><th>Description</th><th>Updated</th><th>Action</th></tr></thead>
              <tbody>
                {(data?.operations ?? []).map((operation) => (
                  <tr key={operation.key}>
                    <td className="font-mono text-xs">{operation.key}</td>
                    <td><StatusPill status={operation.isEnabled ? 'active' : 'disabled'} /></td>
                    <td className="text-xs nova-muted">{operation.description ?? '—'}</td>
                    <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(operation.updatedAt ?? null, locale)}</td>
                    <td>
                      <AdminAction
                        label={operation.isEnabled ? 'Disable' : 'Enable'} tone={operation.isEnabled ? 'danger' : 'primary'}
                        confirmText={operation.isEnabled ? `Disable ${operation.key}? This blocks the operation platform-wide.` : `Enable ${operation.key}?`}
                        onRun={() => toggle(operation)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.operations?.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted">No operations registered.</p> : null}
          </Card>

          <Card className="!p-0">
            <h3 className="p-3 text-sm font-semibold">Active kill switches</h3>
            <table className="nova-table">
              <thead><tr><th>Key</th><th>State</th><th>Reason</th><th>Activated</th><th>Expires</th></tr></thead>
              <tbody>
                {(data?.killSwitches ?? []).map((killSwitch) => (
                  <tr key={killSwitch.key}>
                    <td className="font-mono text-xs">{killSwitch.key}</td>
                    <td><StatusPill status={killSwitch.isActive ? 'active' : 'inactive'} /></td>
                    <td className="text-xs nova-muted">{killSwitch.reason ?? '—'}</td>
                    <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(killSwitch.activatedAt, locale)}</td>
                    <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(killSwitch.expiresAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.killSwitches?.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted">No kill switch has ever been activated.</p> : null}
          </Card>
        </>
      )}
    </div>
  );
}
