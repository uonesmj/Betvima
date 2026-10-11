'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, Field, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';

export function KycClient() {
  const { t, session } = useApp();
  const { data, loading, reload } = useApiQuery<{ kycStatus: string }>(session?.authenticated ? '/api/v1/account/kyc' : null);
  const [form, setForm] = useState({ documentType: 'national_id', documentNumber: '', storagePath: '', selfiePath: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session?.authenticated) {
    return <EmptyState title={session?.authUnavailable ? t('auth.authUnavailable') : t('nav.login')} />;
  }

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest('/api/v1/account/kyc', {
        method: 'POST',
        json: {
          documentType: form.documentType, documentNumber: form.documentNumber,
          storagePath: form.storagePath, selfiePath: form.selfiePath || undefined,
        },
      });
      setMessage(t('account.saved'));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="nova-muted">{t('bets.status')}:</span>
          <StatusPill status={loading ? 'pending' : (data?.kycStatus ?? 'not_started')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Document type">
            <select className="nova-input" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
              <option value="drivers_license">Driver&apos;s licence</option>
            </select>
          </Field>
          <Field label="Document number">
            <input className="nova-input" value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} />
          </Field>
          <Field label="Document file path" hint="Upload to storage first, then paste the path">
            <input className="nova-input" value={form.storagePath} onChange={(e) => setForm({ ...form, storagePath: e.target.value })} />
          </Field>
          <Field label="Selfie file path (optional)">
            <input className="nova-input" value={form.selfiePath} onChange={(e) => setForm({ ...form, selfiePath: e.target.value })} />
          </Field>
        </div>
        <button
          type="button" className="nova-btn-primary mt-4" disabled={busy || !form.documentNumber || !form.storagePath}
          onClick={() => void submit()}
        >
          {busy ? t('common.loading') : t('account.save')}
        </button>
      </Card>
      <Card className="text-xs nova-muted">
        <h3 className="mb-2 text-sm font-semibold text-nova-text">{t('account.kyc')}</h3>
        <p>{t('account.kycHelp')}</p>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>Documents are reviewed by an operator; the decision and the reviewer are audited.</li>
          <li>No automated verification is claimed when no verification provider is configured.</li>
        </ul>
      </Card>
    </div>
  );
}
