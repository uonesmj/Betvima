'use client';

import { useRouter } from 'next/navigation';
import { adminPost } from '@/components/admin/admin-table';
import { useState, type FormEvent } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, DataTable, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface MatchRow {
  id: string; sportKey: string; leagueName: string | null; status: string; scheduledAt: string;
  homeScore: number | null; awayScore: number | null; isLive: boolean; isBettingAvailable: boolean;
  participants: { role: string; name: string }[];
  marketsCount?: number; provider?: string | null;
}

export function MatchesClient() {
  const { t, locale } = useApp();
  const router = useRouter();
  const [filters, setFilters] = useState({ q: '', sport: '', live: false, page: 1 });
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    league: '', homeTeam: '', awayTeam: '', scheduledAt: '',
    homeOdds: '', drawOdds: '', awayOdds: '',
  });
  const createFixture = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const kickoff = new Date(draft.scheduledAt);
      if (!Number.isFinite(kickoff.getTime())) throw new Error('Enter a valid kick-off date');
      const response = await adminPost('/api/v1/admin/matches/manual', {
        ...draft,
        scheduledAt: kickoff.toISOString(),
      }) as { matchId?: string };
      if (!response?.matchId) throw new Error('The server did not return a match ID');
      router.push(`/admin/matches/${response.matchId}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create fixture');
    } finally {
      setCreating(false);
    }
  };
  const query = new URLSearchParams({ page: String(filters.page), pageSize: '25' });
  if (filters.q) query.set('q', filters.q);
  if (filters.sport) query.set('sport', filters.sport);
  if (filters.live) query.set('live', 'true');
  const { data, loading, error, reload } = useApiQuery<{ items: MatchRow[]; total: number }>(`/api/v1/matches?${query.toString()}`, { pollMs: 60_000 });

  const score = (match: MatchRow) => (
    match.homeScore === null && match.awayScore === null
      ? '—'
      : `${match.homeScore ?? '-'} : ${match.awayScore ?? '-'}`
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="nova-btn-primary" onClick={() => setCreateOpen((value) => !value)}>
          {createOpen ? 'Close' : 'Add manual prematch'}
        </button>
      </div>
      {createOpen ? (
        <Card>
          <form className="space-y-3" onSubmit={createFixture}>
            <div>
              <h2 className="text-base font-semibold">New manual football fixture</h2>
              <p className="text-xs nova-muted">Only full-time 1X2. Fixed prices close at kick-off. Results are entered by an operator.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                ['league', 'League'],
                ['homeTeam', 'Home team'],
                ['awayTeam', 'Away team'],
              ] as const).map(([key, label]) => (
                <label key={key} className="block text-xs">
                  <span className="mb-1 block">{label}</span>
                  <input required maxLength={120} className="nova-input" value={draft[key]}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
              <label className="block text-xs">
                <span className="mb-1 block">Kick-off (your local time)</span>
                <input required type="datetime-local" className="nova-input" value={draft.scheduledAt}
                  onChange={(event) => setDraft((current) => ({ ...current, scheduledAt: event.target.value }))} />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['homeOdds', 'Home'],
                ['drawOdds', 'Draw'],
                ['awayOdds', 'Away'],
              ] as const).map(([key, label]) => (
                <label key={key} className="block text-xs">
                  <span className="mb-1 block">{label} odds</span>
                  <input required type="number" min="1.01" max="1000" step="0.0001" inputMode="decimal"
                    placeholder="2.10" className="nova-input" value={draft[key]}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
            {createError ? <ErrorNote message={createError} retryLabel="Retry" /> : null}
            <button className="nova-btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create manual fixture'}
            </button>
          </form>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          className="nova-input !w-auto flex-1 sm:max-w-xs" placeholder="Search team or league"
          value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })}
        />
        <select className="nova-input !w-auto !py-1.5 text-xs" value={filters.sport} onChange={(e) => setFilters({ ...filters, sport: e.target.value, page: 1 })}>
          <option value="">All sports</option>
          {['football', 'basketball', 'tennis', 'volleyball', 'handball', 'hockey', 'esports', 'mma', 'other'].map((sport) => (
            <option key={sport} value={sport}>{sport}</option>
          ))}
        </select>
        <button type="button" className={`nova-tab ${filters.live ? 'nova-tab-active' : ''}`} onClick={() => setFilters({ ...filters, live: !filters.live, page: 1 })}>Live only</button>
        <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void reload()}>Refresh</button>
      </div>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-64 w-full" /> : (
        <Card className="!p-0">
          <DataTable<MatchRow>
            rows={data?.items ?? []}
            rowKey={(row) => row.id}
            empty="No matches. With no sports provider configured, matches must be created by an operator or imported from a provider feed."
            onRowClick={(row) => router.push(`/admin/matches/${row.id}`)}
            columns={[
              { key: 'kickoff', header: 'Kick-off', render: (row) => <span className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.scheduledAt, locale)}</span> },
              { key: 'league', header: 'League', render: (row) => <span className="text-xs">{row.leagueName ?? '—'}<span className="nova-muted"> · {row.sportKey}</span></span> },
              { key: 'match', header: 'Match', render: (row) => <span className="text-xs">{row.participants?.map((p) => p.name).join(' vs ') ?? '—'}</span> },
              { key: 'score', header: 'Score', render: (row) => <span className="text-xs">{score(row)}</span> },
              { key: 'status', header: t('common.status'), render: (row) => <StatusPill status={row.status} /> },
              { key: 'betting', header: 'Betting', render: (row) => <StatusPill status={row.isBettingAvailable ? 'available' : 'suspended'} /> },
              { key: 'markets', header: 'Markets', render: (row) => <span className="text-xs">{row.marketsCount ?? '—'}</span> },
            ]}
          />
        </Card>
      )}
      <p className="text-xs nova-muted">{data?.total ?? 0} matches</p>
    </div>
  );
}
