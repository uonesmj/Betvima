'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface DecisionRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  ruleKey: string | null;
  decision: string;
  reason: string | null;
  stake_minor: string | null;
  payout_minor: string | null;
  usdStakeMinor: string | null;
  usdPayoutMinor: string | null;
  currency: string | null;
  created_at: string;
  context?: Record<string, unknown> | null;
}

export function RiskDecisionsClient() {
  const { t, locale } = useApp();
  const [decision, setDecision] = useState('');
  const query = new URLSearchParams({ pageSize: '50' });
  if (decision) query.set('decision', decision);
  const { data, loading, error, reload } = useApiQuery<{ items: DecisionRow[] }>(`/api/v1/admin/risk/decisions?${query.toString()}`, { pollMs: 60_000 });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {['', 'ALLOW', 'REVIEW', 'LIMIT', 'WARN', 'REJECT'].map((option) => (
          <button key={option || 'all'} type="button" className={`nova-tab ${decision === option ? 'nova-tab-active' : ''}`} onClick={() => setDecision(option)}>{option || 'all'}</button>
        ))}
      </div>
      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="!p-0">
          <table className="nova-table">
            <thead><tr><th>When</th><th>Customer</th><th>Rule</th><th>Decision</th><th>Stake</th><th>Payout</th><th>Reason</th></tr></thead>
            <tbody>
              {(data?.items ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.created_at, locale)}</td>
                  <td className="font-mono text-[11px]">{row.user_email ?? (row.user_id ? row.user_id.slice(0, 8) : '—')}</td>
                  <td className="text-xs">{row.ruleKey ?? '—'}</td>
                  <td><StatusPill status={(row.decision ?? 'unknown').toLowerCase()} /></td>
                  <td className="whitespace-nowrap text-xs">
                    {row.usdStakeMinor !== null ? formatMinor(row.usdStakeMinor, 'USD', locale) : '—'}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {row.usdPayoutMinor !== null ? formatMinor(row.usdPayoutMinor, 'USD', locale) : '—'}
                  </td>
                  <td className="max-w-[32ch] truncate text-xs nova-muted" title={row.reason ?? ''}>{row.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.items.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted">No risk decisions recorded.</p> : null}
        </Card>
      )}
    </div>
  );
}
