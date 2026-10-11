'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Field } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';

interface Limits {
  maxStakePerBetMinor: string | null; maxStakePerDayMinor: string | null; lossLimitDailyMinor: string | null;
  lossLimitWeeklyMinor: string | null; depositLimitDailyMinor: string | null; depositLimitWeeklyMinor: string | null;
  sessionLimitMinutes: number | null;
}

export function LimitsClient() {
  const { t, session } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ limits: Limits }>(session?.authenticated ? '/api/v1/account/limits' : null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.limits) return;
    setForm({
      lossLimitDailyMinor: data.limits.lossLimitDailyMinor ?? '',
      lossLimitWeeklyMinor: data.limits.lossLimitWeeklyMinor ?? '',
      depositLimitDailyMinor: data.limits.depositLimitDailyMinor ?? '',
      depositLimitWeeklyMinor: data.limits.depositLimitWeeklyMinor ?? '',
      maxStakePerBetMinor: data.limits.maxStakePerBetMinor ?? '',
      sessionLimitMinutes: data.limits.sessionLimitMinutes?.toString() ?? '',
    });
  }, [data]);

  if (!session?.authenticated) {
    return <EmptyState title={session?.authUnavailable ? t('auth.authUnavailable') : t('nav.login')} />;
  }

  const save = async () => {
    setMessage(null);
    try {
      await apiRequest('/api/v1/account/limits', {
        method: 'PATCH',
        json: {
          lossLimitDailyMinor: form.lossLimitDailyMinor || null,
          lossLimitWeeklyMinor: form.lossLimitWeeklyMinor || null,
          depositLimitDailyMinor: form.depositLimitDailyMinor || null,
          depositLimitWeeklyMinor: form.depositLimitWeeklyMinor || null,
          maxStakePerBetMinor: form.maxStakePerBetMinor || null,
          sessionLimitMinutes: form.sessionLimitMinutes ? Number(form.sessionLimitMinutes) : null,
        },
      });
      setMessage(t('account.saved'));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const FIELDS: { key: keyof Limits; label: string }[] = [
    { key: 'lossLimitDailyMinor', label: 'Daily loss limit (minor units)' },
    { key: 'lossLimitWeeklyMinor', label: 'Weekly loss limit (minor units)' },
    { key: 'depositLimitDailyMinor', label: 'Daily deposit limit (minor units)' },
    { key: 'depositLimitWeeklyMinor', label: 'Weekly deposit limit (minor units)' },
    { key: 'maxStakePerBetMinor', label: 'Max stake per bet (minor units)' },
    { key: 'sessionLimitMinutes', label: 'Session limit (minutes)' },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <p className="mb-3 text-xs nova-muted">{t('account.limitsHelp')}</p>
        <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
        {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <Field key={field.key} label={field.label}>
              <input
                className="nova-input" inputMode="numeric" disabled={loading}
                value={form[field.key] ?? ''}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value.replace(/[^\d]/g, '') })}
                placeholder="—"
              />
            </Field>
          ))}
        </div>
        <button type="button" className="nova-btn-primary mt-4" onClick={() => void save()}>{t('account.save')}</button>
      </Card>
      <Card className="text-xs nova-muted">
        <h3 className="mb-2 text-sm font-semibold text-nova-text">{t('account.selfExclude')}</h3>
        <p>{t('account.selfExcludeHelp')}</p>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>Self-exclusion is applied by the server and cannot be lifted before it expires.</li>
          <li>Loss limits are checked against settled results for the current day and week.</li>
          <li>Deposit limits are checked when a request is created before it is sent to the payment provider.</li>
        </ul>
      </Card>
    </div>
  );
}
