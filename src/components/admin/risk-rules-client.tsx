'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Field, Skeleton, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Rule {
  id: string; key: string; scope: string; scopeRef: string | null; isEnabled: boolean;
  thresholdMinor: string | null; thresholdCount: number | null; thresholdBps: number | null;
  action: string; priority: number; params: Record<string, unknown>; updatedAt: string;
}

export function RiskRulesClient() {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ rules: Rule[] }>('/api/v1/admin/risk/rules');
  const [form, setForm] = useState({ key: '', scope: 'GLOBAL', scopeRef: '', thresholdMinor: '', thresholdCount: '', thresholdBps: '', action: 'REVIEW', priority: '100', reason: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest('/api/v1/admin/risk/rules', {
        method: 'POST',
        json: {
          key: form.key, scope: form.scope, scopeRef: form.scopeRef || null,
          thresholdMinor: form.thresholdMinor || null,
          thresholdCount: form.thresholdCount ? Number(form.thresholdCount) : null,
          thresholdBps: form.thresholdBps ? Number(form.thresholdBps) : null,
          action: form.action, priority: Number(form.priority), isEnabled: true,
          reason: form.reason || null,
        },
      });
      setMessage(t('account.saved'));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
        {loading && !data ? <Skeleton className="h-48 w-full" /> : (
          <Card className="!p-0">
            <table className="nova-table">
              <thead><tr><th>Key</th><th>Scope</th><th>Threshold</th><th>Action</th><th>Priority</th><th>Enabled</th><th>Updated</th></tr></thead>
              <tbody>
                {(data?.rules ?? []).map((rule) => (
                  <tr key={rule.id}>
                    <td className="text-xs">{rule.key}</td>
                    <td className="text-xs nova-muted">{rule.scope}{rule.scopeRef ? ` · ${rule.scopeRef}` : ''}</td>
                    <td className="whitespace-nowrap text-xs">
                      {rule.params?.usdThresholdMinor ? formatMinor(String(rule.params.usdThresholdMinor), 'USD', locale) : ''}
                      {rule.thresholdCount !== null ? ` ${rule.thresholdCount}×` : ''}
                      {rule.thresholdBps !== null ? ` ${(rule.thresholdBps / 100).toFixed(2)}%` : ''}
                      {!rule.thresholdMinor && rule.thresholdCount === null && rule.thresholdBps === null ? '—' : ''}
                    </td>
                    <td><StatusPill status={rule.action.toLowerCase()} /></td>
                    <td className="text-xs">{rule.priority}</td>
                    <td><StatusPill status={rule.isEnabled ? 'active' : 'disabled'} /></td>
                    <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(rule.updatedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.rules.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted">No rules configured.</p> : null}
          </Card>
        )}
      </div>

      <Card>
        <h3 className="mb-2 text-sm font-semibold">Add a rule</h3>
        {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
        <div className="space-y-3">
          <Field label="Rule key" hint="e.g. stake_spike, multi_account, arbing, payout_velocity">
            <input className="nova-input" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          </Field>
          <Field label="Scope">
            <select className="nova-input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              {['GLOBAL', 'SPORT', 'LEAGUE', 'AFFILIATE', 'USER'].map((scope) => <option key={scope} value={scope}>{scope}</option>)}
            </select>
          </Field>
          <Field label="Scope reference (sport key, league, affiliate or user id)"><input className="nova-input" value={form.scopeRef} onChange={(e) => setForm({ ...form, scopeRef: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Threshold (minor)"><input className="nova-input" inputMode="numeric" value={form.thresholdMinor} onChange={(e) => setForm({ ...form, thresholdMinor: e.target.value.replace(/[^\d]/g, '') })} /></Field>
            <Field label="Count"><input className="nova-input" inputMode="numeric" value={form.thresholdCount} onChange={(e) => setForm({ ...form, thresholdCount: e.target.value.replace(/[^\d]/g, '') })} /></Field>
            <Field label="Basis points"><input className="nova-input" inputMode="numeric" value={form.thresholdBps} onChange={(e) => setForm({ ...form, thresholdBps: e.target.value.replace(/[^\d]/g, '') })} /></Field>
          </div>
          <Field label="Action">
            <select className="nova-input" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
              {['REVIEW', 'LIMIT', 'WARN', 'REJECT'].map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </Field>
          <Field label="Priority"><input className="nova-input" inputMode="numeric" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value.replace(/[^\d]/g, '') })} /></Field>
          <Field label="Reason (optional)"><input className="nova-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <button type="button" className="nova-btn-primary w-full" disabled={busy || form.key.length < 3} onClick={() => void create()}>
            {busy ? t('common.loading') : 'Create rule'}
          </button>
        </div>
      </Card>
    </div>
  );
}
