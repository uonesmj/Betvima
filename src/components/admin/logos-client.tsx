'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface Breakdown {
  sport: string;
  total: number;
  withLogo: number;
  missing: number;
}

interface Coverage {
  total: number;
  withLogo: number;
  missing: number;
  bySport: Breakdown[];
}

interface LogosData {
  teams: Coverage;
  leagues: Coverage;
  cache: { source: string; total: number; hits: number }[];
  worker: { status: string; updatedAt: string; processed: number; failed: number } | null;
  missingSamples: { name: string; sport: string }[];
}

function pct(part: number, total: number): string {
  if (total <= 0) return '—';
  return Math.round((part / total) * 100) + '%';
}

function CoverageBar({ withLogo, total }: { withLogo: number; total: number }) {
  const ratio = total > 0 ? Math.min(100, Math.round((withLogo / total) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-nova-surface2">
      <div
        className="h-full rounded-full bg-gradient-to-r from-nova-primary to-nova-gold transition-all"
        style={{ width: ratio + '%' }}
      />
    </div>
  );
}

export function LogosClient() {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<LogosData>('/api/v1/admin/logos', { pollMs: 30_000 });
  const [sweeping, setSweeping] = useState(false);
  const [sweepNote, setSweepNote] = useState<string | null>(null);

  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  if (error && !data) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;
  if (!data) return <EmptyState title="No data" hint="Logo coverage stats are unavailable." />;

  const runSweep = async () => {
    setSweeping(true);
    setSweepNote(null);
    try {
      const result = await apiRequest<{ jobId: string; duplicate: boolean }>('/api/v1/admin/logos', {
        method: 'POST',
        json: {},
      });
      setSweepNote('Sweep job enqueued (' + result.jobId.slice(0, 8) + '…). The logo worker picks it up within seconds.');
      setTimeout(() => void reload(), 5000);
    } catch (err) {
      setSweepNote('Failed to enqueue sweep: ' + (err as Error).message);
    } finally {
      setSweeping(false);
    }
  };

  const sections: { title: string; coverage: Coverage }[] = [
    { title: 'Teams', coverage: data.teams },
    { title: 'Leagues', coverage: data.leagues },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{section.title} logo coverage</h2>
              <span className="text-lg font-black text-nova-gold">
                {pct(section.coverage.withLogo, section.coverage.total)}
              </span>
            </div>
            <CoverageBar withLogo={section.coverage.withLogo} total={section.coverage.total} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-nova-surface2 p-2.5">
                <div className="text-xl font-black">{section.coverage.total.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wide nova-muted">Total</div>
              </div>
              <div className="rounded-xl bg-nova-surface2 p-2.5">
                <div className="text-xl font-black text-emerald-400">{section.coverage.withLogo.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wide nova-muted">With logo</div>
              </div>
              <div className="rounded-xl bg-nova-surface2 p-2.5">
                <div className="text-xl font-black text-amber-400">{section.coverage.missing.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wide nova-muted">Missing</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title + '-sports'}>
            <h2 className="mb-2 text-sm font-semibold">{section.title} by sport</h2>
            {section.coverage.bySport.length === 0 ? (
              <EmptyState title={'No ' + section.title.toLowerCase()} hint="Rows appear after the first odds sync." />
            ) : (
              <table className="nova-table">
                <thead><tr><th>Sport</th><th>Total</th><th>With logo</th><th>Missing</th><th>Coverage</th></tr></thead>
                <tbody>
                  {section.coverage.bySport.map((row) => (
                    <tr key={row.sport}>
                      <td className="text-xs font-bold">{row.sport}</td>
                      <td className="text-xs">{row.total.toLocaleString()}</td>
                      <td className="text-xs text-emerald-400">{row.withLogo.toLocaleString()}</td>
                      <td className="text-xs text-amber-400">{row.missing.toLocaleString()}</td>
                      <td className="text-xs">{pct(row.withLogo, row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Logo worker</h2>
            <p className="mt-1 text-[11px] nova-muted">
              Resolves official badges (ESPN, then sport-verified TheSportsDB) and HEAD-verifies every URL.
              {data.worker ? (
                <>
                  {' '}Last heartbeat <StatusPill status={data.worker.status} />{' '}
                  {formatDateTime(data.worker.updatedAt, locale)} · processed {data.worker.processed} · failed {data.worker.failed}
                </>
              ) : (
                ' No heartbeat yet — the worker has never run.'
              )}
            </p>
          </div>
          <button type="button" onClick={() => void runSweep()} disabled={sweeping} className="nova-btn-primary text-sm disabled:opacity-50">
            {sweeping ? 'Enqueuing…' : 'Run sweep now'}
          </button>
        </div>
        {sweepNote ? <p className="mt-2 text-xs nova-muted">{sweepNote}</p> : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Resolver cache</h2>
          {data.cache.length === 0 ? (
            <EmptyState title="Cache empty" hint="Entries appear after the first sweep." />
          ) : (
            <table className="nova-table">
              <thead><tr><th>Source</th><th>Cached names</th><th>Resolved</th></tr></thead>
              <tbody>
                {data.cache.map((row) => (
                  <tr key={row.source}>
                    <td className="text-xs font-bold">{row.source}</td>
                    <td className="text-xs">{row.total.toLocaleString()}</td>
                    <td className="text-xs">{row.hits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Teams still missing logos (latest)</h2>
          {data.missingSamples.length === 0 ? (
            <EmptyState title="All teams have logos" hint="Every team row currently has a badge." />
          ) : (
            <table className="nova-table">
              <thead><tr><th>Team</th><th>Sport</th></tr></thead>
              <tbody>
                {data.missingSamples.map((row) => (
                  <tr key={row.sport + ':' + row.name}>
                    <td className="text-xs">{row.name}</td>
                    <td className="text-xs nova-muted">{row.sport}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
