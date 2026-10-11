'use client';

import { useState } from 'react';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Field, Skeleton, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Adjustment {
  id: string; userId: string; userEmail?: string | null; direction: 'credit' | 'debit'; amountMinor: string; usdAmountMinor: string;
  currency: string; type: string; reason: string; status: string; requestedBy: string; requestedAt: string;
  approvedBy: string | null; approvedAt: string | null; decisionReason: string | null;
}

export function AdjustmentsClient() {
  const { t, locale } = useApp();
  const [status, setStatus] = useState('');
  const query = new URLSearchParams({ pageSize: '50' });
  if (status) query.set('status', status);
  const { data, loading, error, reload } = useApiQuery<{ items: Adjustment[]; total: number }>(`/api/v1/admin/wallet/adjustments?${query.toString()}`);
  const [form, setForm] = useState({ userId: '', amountMinor: '', currency: 'USD', direction: 'credit', type: 'goodwill', reason: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest('/api/v1/admin/wallet/adjustments', { method: 'POST', idempotencyKey: crypto.randomUUID(), json: form });
      setMessage('Adjustment requested — a second operator must approve it before money moves.');
      setForm({ ...form, userId: '', amountMinor: '', reason: '' });
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {['', 'pending', 'approved', 'rejected', 'applied'].map((option) => (
            <button key={option || 'all'} type="button" className={`nova-tab ${status === option ? 'nova-tab-active' : ''}`} onClick={() => setStatus(option)}>
              {option || 'all'}
            </button>
          ))}
        </div>
        <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
        {loading && !data ? <Skeleton className="h-48 w-full" /> : (
          <Card className="!p-0 overflow-hidden">
            <div className="w-full overflow-x-auto">
            <table className="nova-table min-w-[900px]">
              <thead><tr><th>Requested</th><th>User</th><th>Amount</th><th>Type</th><th>Reason</th><th>Status</th><th>تصمیم</th></tr></thead>
              <tbody>
                {(data?.items ?? []).map((adjustment) => (
                  <tr key={adjustment.id}>
                    <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(adjustment.requestedAt, locale)}</td>
                    <td className="font-mono text-[11px]">{adjustment.userEmail ?? adjustment.userId.slice(0, 8)}</td>
                    <td className={`whitespace-nowrap text-xs ${adjustment.direction === 'debit' ? 'text-nova-danger' : 'text-nova-primary'}`}>
                      {adjustment.direction === 'debit' ? '-' : '+'}{formatMinor(adjustment.usdAmountMinor, 'USD', locale)}
                    </td>
                    <td className="text-xs">{adjustment.type}</td>
                    <td className="max-w-[18ch] truncate text-xs nova-muted" title={adjustment.reason}>{adjustment.reason}</td>
                    <td><StatusPill status={adjustment.status} /></td>
                    <td>
                      {adjustment.status === 'pending' ? (
                        <span className="flex gap-1">
                          <AdminAction
                            label="Approve" tone="primary"
                            confirmText="Approve this adjustment? Dual control makes self-approval impossible."
                            onRun={async () => { await adminPost(`/api/v1/admin/wallet/adjustments/${adjustment.id}/approve`, { approve: true, reason: 'second operator approval' }); await reload(); }}
                          />
                          <AdminAction
                            label="Reject" tone="danger"
                            onRun={async () => { await adminPost(`/api/v1/admin/wallet/adjustments/${adjustment.id}/approve`, { approve: false, reason: 'second operator rejection' }); await reload(); }}
                          />
                        </span>
                      ) : (
                        <span className="text-[11px] nova-muted">{adjustment.decisionReason ?? formatDateTime(adjustment.approvedAt, locale)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {(data?.items.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted">No adjustments.</p> : null}
          </Card>
        )}
      </div>

      <Card className="order-first lg:col-span-2">
        <h3 className="mb-2 text-sm font-semibold">Request an adjustment</h3>
        {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
        <div className="space-y-3">
          <Field label="Customer id (UUID)"><input className="nova-input font-mono" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} /></Field>
          <Field label="Amount (minor units)"><input className="nova-input" inputMode="numeric" value={form.amountMinor} onChange={(e) => setForm({ ...form, amountMinor: e.target.value.replace(/[^\d]/g, '') })} /></Field>
          <Field label="Currency">
          <select
            className="nova-input"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            <option value="USD">USD</option>
            <option value="IRT">IRT</option>
            <option value="IRR">IRR</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </Field>
        <Field label="Direction">
            <select className="nova-input" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="credit">Credit (add to balance)</option>
              <option value="debit">Debit (take from balance)</option>
            </select>
          </Field>
          <Field label="Type">
            <select className="nova-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['goodwill', 'error_correction', 'chargeback', 'bonus_correction', 'manual_deposit', 'manual_withdrawal'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Reason (min 8 characters)"><input className="nova-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <button type="button" className="nova-btn-primary w-full" disabled={busy || form.reason.length < 8 || !form.userId || !form.amountMinor} onClick={() => void request()}>
            {busy ? t('common.loading') : 'Request adjustment'}
          </button>
          <p className="text-[11px] nova-muted">
            Dual control is enforced in the database: the approver must be a different operator, and the ledger entry is
            written only on approval.
          </p>
        </div>
      </Card>
    </div>
  );
}
