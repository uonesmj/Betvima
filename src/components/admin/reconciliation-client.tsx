'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Issue {
  checkKey: string; severity: string; description: string; entityType: string; entityId: string | null;
  expected: string | null; actual: string | null; detectedAt: string;
}
interface Report { id: string | null; runAt: string; durationMs: number; passed: boolean; checksRun: number; issues: Issue[]; summary: Record<string, unknown> }
interface RunRow {
  id: string; run_at: string; period_start: string; period_end: string; check_key: string; status: string;
  expected_minor: string | null; actual_minor: string | null; difference_minor: string | null; details: string | null;
}

export function ReconciliationClient() {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ runs: RunRow[] }>('/api/v1/admin/reconciliation?limit=25');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiRequest<{ report: Report }>('/api/v1/admin/reconciliation', { method: 'POST', json: {} });
      setReport(result.report);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="nova-btn-primary" disabled={busy} onClick={() => void run()}>
            {busy ? t('common.loading') : 'Run reconciliation now'}
          </button>
          <span className="text-xs nova-muted">Six control checks: wallet ledger, bet settlement, payouts, affiliate ledger, affiliate payable, cash-out.</span>
        </div>
        {message ? <div className="mt-2 text-xs text-nova-danger">{message}</div> : null}
        {report ? (
          <div className="mt-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <Stat label="Result" value={<StatusPill status={report.passed ? 'passed' : 'failed'} />} />
              <Stat label="Checks run" value={report.checksRun} />
              <Stat label="Findings" value={report.issues.length} tone={report.issues.length > 0 ? 'danger' : 'success'} />
            </div>
            {report.issues.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {report.issues.map((issue) => (
                  <li key={`${issue.checkKey}-${issue.entityId ?? ''}`} className="border-b border-nova-line/50 pb-1">
                    <span className="text-nova-danger">{issue.severity}</span> · {issue.checkKey}: {issue.description}
                    {issue.expected || issue.actual ? <span className="nova-muted"> (expected {issue.expected ?? '—'} / actual {issue.actual ?? '—'})</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-nova-primary">No discrepancy found. Every ledger sum equals its balance and every settlement matches its recorded payout.</p>
            )}
          </div>
        ) : null}
      </Card>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="!p-0">
          <h3 className="p-3 text-sm font-semibold">Recorded checks</h3>
          <table className="nova-table">
            <thead><tr><th>Run</th><th>Period</th><th>Check</th><th>Status</th><th>Expected (native)</th><th>Actual (native)</th><th>Difference (native)</th></tr></thead>
            <tbody>
              {(data?.runs ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.run_at, locale)}</td>
                  <td className="whitespace-nowrap text-[11px] nova-muted">{formatDateTime(row.period_start, locale)} → {formatDateTime(row.period_end, locale)}</td>
                  <td className="font-mono text-[11px]">{row.check_key}</td>
                  <td><StatusPill status={row.status} /></td>
                  <td className="whitespace-nowrap text-xs">{row.expected_minor ? row.expected_minor : '—'}</td>
                  <td className="whitespace-nowrap text-xs">{row.actual_minor ? row.actual_minor : '—'}</td>
                  <td className={`whitespace-nowrap text-xs ${row.difference_minor && BigInt(row.difference_minor) !== 0n ? 'text-nova-danger' : 'nova-muted'}`}>
                    {row.difference_minor ? row.difference_minor : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.runs.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted">No reconciliation has been run yet.</p> : null}
        </Card>
      )}
    </div>
  );
}
