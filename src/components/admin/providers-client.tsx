'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface ProviderStatus {
  provider: string; category: 'sports' | 'payments' | 'notifications' | string;
  configured: boolean; enabled: boolean; reachable: boolean | null;
  lastSuccessAt: string | null; lastErrorAt: string | null; lastError: string | null;
  requiredEnv: string[]; notes: string | null;
}
interface HealthRow {
  provider: string; kind: string; status: string; last_success_at: string | null; last_error_at: string | null;
  last_error: string | null; consecutive_failures: number; latency_ms: number | null; updated_at: string;
}

interface TrialReport {
  focusCountries: Array<{ code: string; live: number; upcoming: number }>;
  configured: boolean; checkedAt: string; remainingHourlyRequests: number | null; mode: 'read_only';
  sports: Array<{ sport: string; sportId: number; liveFixtures: number;
    liveWithClock: number; liveWithScore: number; upcomingFixtures: number;
    sample: Array<{ id: string; bet365Id: string | null; home: string; away: string; minute: number | null;
      score: string | null; league: string }>;
    upcomingSample: Array<{ id: string; home: string; away: string; league: string; time: string | null }>;
    error: string | null }>;
  oddsSample: Array<{ sport: string; eventId: string; marketKeys: number; latestOffers: number;
    freshMarkets: number; freshSelections: number; error: string | null }>;
  bet365: { permitted: boolean; eventCount: number; sampleFixtureId: string | null;
    marketCount: number; priceCount: number; error: string | null;
    upcomingAccess: string; upcomingCount: number;
    pricedEventCount: number; sampledEventCount: number;
    samples: Array<{ fixtureId: string; linkedEventId: string | null; match: string;
      markets: number; selections: number; error: string | null }> };
  callsInProbe: number; durationMs: number;
  notes: string[];
}

interface NormalizedReport {
  mode: 'shadow_read_only'; activeSource: 'the_odds_api'; inspectedSource: 'betsapi';
  configured: boolean; checkedAt: string; liveCount: number; diagnostic: string | null;
  live: Array<{ providerId: string; sport: string; home: string; away: string;
    score: string | null; minute: number | null;
    marketCount: number; selectionCount: number;
    markets: Array<{ key: string; selections: Array<{ code: string; decimalOdds: string }> }> }>;
}

export function ProvidersClient() {
  const { t, locale } = useApp();
  const [trial, setTrial] = useState<TrialReport | null>(null);
  const [trialToken, setTrialToken] = useState('');
  const [showTrialList, setShowTrialList] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [shadow, setShadow] = useState<NormalizedReport | null>(null);
  const [shadowError, setShadowError] = useState<string | null>(null);
  const [shadowBusy, setShadowBusy] = useState(false);
  async function inspectShadow() {
    setShadowBusy(true);
    setShadowError(null);
    try {
      setShadow(await apiRequest<NormalizedReport>('/api/v1/admin/betsapi/normalized', { cache: 'no-store' }));
    } catch {
      setShadowError('Could not inspect staged BetsAPI markets.');
    } finally { setShadowBusy(false); }
  }
  async function checkBetsApi() {
    setTrialBusy(true);
    setTrialError(null);
    try {
      setTrial(trialToken.trim()
        ? await apiRequest<TrialReport>('/api/v1/admin/betsapi/trial', {
            method: 'POST', json: { token: trialToken.trim() }, cache: 'no-store',
          })
        : await apiRequest<TrialReport>('/api/v1/admin/betsapi/trial', { cache: 'no-store' }));
      setTrialToken('');
    } catch {
      setTrialError('Could not inspect the trial feed. Check server configuration and permissions.');
    } finally {
      setTrialBusy(false);
    }
  }
  const { data, loading, error, reload } = useApiQuery<{ statuses: ProviderStatus[]; health: HealthRow[] }>('/api/v1/admin/providers', { pollMs: 60_000 });

  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  if (error && !data) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold">Configured integrations</h2>
        <table className="nova-table">
          <thead><tr><th>Category</th><th>Provider</th><th>Configured</th><th>Enabled</th><th>Reachable</th><th>Required env</th><th>Notes</th></tr></thead>
          <tbody>
            {(data?.statuses ?? []).map((status) => (
              <tr key={`${status.category}-${status.provider}`}>
                <td className="text-xs">{status.category}</td>
                <td className="text-xs">{status.provider}</td>
                <td><StatusPill status={status.configured ? 'ok' : 'disabled'} /></td>
                <td><StatusPill status={status.enabled ? 'active' : 'disabled'} /></td>
                <td><StatusPill status={status.reachable === null ? 'unknown' : status.reachable ? 'ok' : 'down'} /></td>
                <td className="text-[11px] nova-muted">{status.requiredEnv?.join(', ')}</td>
                <td className="text-[11px] nova-muted">{status.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] nova-muted">
          Nothing is faked: with a provider disabled the platform returns NOT_CONFIGURED and keeps money and odds untouched.
          Add the environment variables and restart the server/workers to activate an integration.
        </p>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">BetsAPI — 3-day evaluation</h2>
            <p className="text-xs nova-muted">Read-only coverage probe. Does not change public odds, wagers, or settlement.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="password" autoComplete="off" spellCheck={false}
              aria-label="New BetsAPI token for one-time test" value={trialToken}
              onChange={(e) => setTrialToken(e.target.value)}
              placeholder="New token (one-time, never saved)"
              className="min-w-[215px] rounded-lg border border-nova-border bg-transparent px-3 py-2 text-xs" />
            <button type="button" className="rounded-lg border border-nova-border px-4 py-2 text-sm font-semibold hover:opacity-80"
              disabled={trialBusy} onClick={() => void checkBetsApi()}>
              {trialBusy ? 'Checking live data…' : 'Run 7-sport evaluation'}
            </button>
          </div>
        </div>
        {trialError && <p role="alert" className="text-xs text-nova-danger">{trialError}</p>}
        <div className="mb-3 flex flex-wrap gap-3">
          <button type="button" onClick={() => void inspectShadow()} disabled={shadowBusy}
            className="rounded-lg border border-nova-border px-4 py-2 text-xs font-semibold hover:opacity-80">
            {shadowBusy ? 'Inspecting…' : 'Inspect normalized live odds (shadow)'}
          </button>
          <span className="self-center text-xs nova-muted">No betting, deposits, or settlement changes.</span>
        </div>
        {shadowError && <p role="alert" className="text-xs text-nova-danger">{shadowError}</p>}
        {shadow && (
          <div className="mb-4 space-y-2">
            <p className="text-xs nova-muted">Active: The Odds API · Shadow: BetsAPI · Live fixtures: {shadow.liveCount}
              {shadow.diagnostic ? ` · ${shadow.diagnostic}` : ''}</p>
            {shadow.live.map(event => (
              <div key={event.providerId} className="rounded-lg border border-nova-border p-3">
                <p className="text-sm font-semibold">{event.home} — {event.away}
                  {' '}· {event.score ?? '—'} · {event.minute ?? '—'} min</p>
                <p className="text-xs nova-muted">{event.marketCount} fresh markets · {event.selectionCount} priced outcomes</p>
                {event.markets.map(market => (
                  <div key={market.key} className="flex flex-wrap gap-2 text-xs">
                    <strong>{market.key}</strong>
                    {market.selections.map((selection, i) => (
                      <span key={`${selection.code}:${i}`}>{selection.code}: {selection.decimalOdds}</span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {trial && !trial.configured && (
          <p className="text-xs nova-muted">Enter a freshly rotated token in the field above to evaluate immediately, or set BETSAPI_TRIAL_TOKEN in the server environment.</p>
        )}
        {trial?.configured && (
          <div className="space-y-3">
            <p className="text-xs nova-muted">Checked: {formatDateTime(trial.checkedAt, locale)} · Mode: read-only · Requests used: {trial.callsInProbe} · Duration: {Math.round(trial.durationMs / 1000)}s · Hourly requests remaining: {trial.remainingHourlyRequests ?? 'unknown'}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="nova-muted">Priority countries (current snapshot):</span>
              {trial.focusCountries.map(c => (
                <span key={c.code} className="rounded-md border border-nova-border px-2 py-1">
                  {c.code.toUpperCase()} · {c.live} live / {c.upcoming} upcoming
                </span>
              ))}
              <button type="button" className="rounded-md border border-nova-border px-3 py-1"
                onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(trial, null, 2)); }}>
                Copy report for purchase decision
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="nova-table">
                <thead><tr><th>Sport</th><th>Live</th><th>Clock / score</th><th>Upcoming</th><th>Example fixture</th><th>Source status</th></tr></thead>
                <tbody>{trial.sports.map(row => (
                  <tr key={row.sportId}>
                    <td>{row.sport}</td><td>{row.liveFixtures}</td>
                    <td>{row.liveWithClock}/{row.liveWithScore}</td><td>{row.upcomingFixtures}</td>
                    <td className="text-xs">{row.sample[0] ? `${row.sample[0].home} — ${row.sample[0].away}` : '—'}</td>
                    <td className="text-xs">{row.error ?? 'OK'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="w-full space-y-1 rounded-lg border border-nova-border p-3">
                <p>Bet365 live list: <strong>{trial.bet365.permitted ? 'Available' : trial.bet365.error ?? 'Unavailable'}</strong>
                  {' '}· {trial.bet365.eventCount} listed events</p>
                <p>Live odds verified: <strong>{trial.bet365.pricedEventCount} / {trial.bet365.sampledEventCount} sampled fixtures</strong>
                  {' '}· {trial.bet365.marketCount} fresh sample markets · {trial.bet365.priceCount} outcomes.
                  {trial.bet365.error ? ` Diagnostic: ${trial.bet365.error}` : ''}</p>
                <p>Bet365 Prematch list: <strong>{trial.bet365.upcomingAccess}</strong>
                  {' '}· {trial.bet365.upcomingCount} events on sampled page.</p>
                {trial.bet365.samples.map(sample => (
                  <p key={sample.fixtureId}>
                    FI {sample.fixtureId} · {sample.match || 'Unlabeled fixture'}
                    {' '}· {sample.markets} markets / {sample.selections} outcomes
                    {sample.error ? ` · ${sample.error}` : ''}
                  </p>
                ))}
                <p className="nova-muted">Numbers describe selected fixtures only, not total Bet365 market availability.</p>
              </div>
              {trial.oddsSample.map(row => (
                <span key={row.eventId}>{row.sport}: {row.marketKeys} historical groups · <strong>{row.freshMarkets} fresh markets / {row.freshSelections} outcomes</strong>
                  {row.error && ` (${row.error})`}</span>
              ))}
            </div>
            <button type="button" onClick={() => setShowTrialList(v => !v)}
              className="rounded-lg border border-nova-border px-3 py-2 text-xs">
              {showTrialList ? 'Hide sample fixtures' : 'Show live and upcoming fixture lists'}
            </button>
            {showTrialList && trial.sports.map(sport => (
              <div key={sport.sportId} className="space-y-2 rounded-lg border border-nova-border p-3">
                <p className="text-sm font-semibold">{sport.sport}</p>
                <p className="text-xs nova-muted">Live — {sport.liveFixtures} fixtures</p>
                {sport.sample.map(row => (
                  <p key={`l-${sport.sportId}-${row.id}`} className="text-xs">
                    {row.home} – {row.away} · {row.league} · {row.score ?? '—'} · {row.minute ?? '—'}m
                  </p>
                ))}
                <p className="text-xs nova-muted">Upcoming — {sport.upcomingFixtures} fixtures</p>
                {sport.upcomingSample.map(row => (
                  <p key={`u-${sport.sportId}-${row.id}`} className="text-xs">
                    {row.home} – {row.away} · {row.league} · {row.time ? formatDateTime(row.time, locale) : '—'}
                  </p>
                ))}
              </div>
            ))}
            <p className="text-xs nova-muted">BetsAPI trial data is diagnostic only; do not infer that quoted markets are eligible for real-money placement.</p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">Provider health log</h2>
        {(data?.health ?? []).length === 0 ? (
          <EmptyState title="No provider calls recorded" hint="Health rows appear after the first odds sync, payment call or notification attempt." />
        ) : (
          <table className="nova-table">
            <thead><tr><th>Type</th><th>Provider</th><th>Status</th><th>Errors</th><th>Latency</th><th>Last success</th><th>Last error</th></tr></thead>
            <tbody>
              {data!.health.map((row) => (
                <tr key={`${row.kind}-${row.provider}`}>
                  <td className="text-xs">{row.kind}</td>
                  <td className="text-xs">{row.provider}</td>
                  <td><StatusPill status={row.status} /></td>
                  <td className="text-xs">{row.consecutive_failures}</td>
                  <td className="text-xs nova-muted">{row.latency_ms === null ? '—' : `${row.latency_ms} ms`}</td>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.last_success_at, locale)}</td>
                  <td className="text-[11px] text-nova-danger">{row.last_error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
