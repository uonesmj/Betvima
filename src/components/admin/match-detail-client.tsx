'use client';

import { useState } from 'react';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Field, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatOddsScaled } from '@/lib/i18n';

interface Selection {
  id: string; code: string; nameEn: string; nameFa: string; oddsScaled: string; previousOddsScaled: string | null;
  oddsVersion: number; status: string; line: string | null;
}
interface Market {
  id: string; key: string; nameEn: string; nameFa: string; status: string; version: number; selections: Selection[];
}
interface Match {
  id: string; status: string; scheduledAt: string; homeScore: number | null; awayScore: number | null;
  leagueName: string | null; sportKey: string; isLive: boolean; isBettingAvailable: boolean; updatedAt: string;
  participants: { role: string; name: string }[];
}

export function MatchDetailClient({ matchId }: { matchId: string }) {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ match: Match; markets: Market[]; result: { revision: number; status: string; homeScore: number | null; awayScore: number | null; authoritative: boolean; observedAt: string } | null }>(
    `/api/v1/matches/${matchId}?includeSuspended=true`,
  );
  const [result, setResult] = useState({
    status: 'finished', homeScore: '', awayScore: '', homeHalfScore: '', awayHalfScore: '',
    homeCorners: '', awayCorners: '', homeCards: '', awayCards: '', extraTime: false, penalties: false, note: '',
  });
  const [reason, setReason] = useState('');
  const [oddsDraft, setOddsDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorNote message={error ?? 'Not found'} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const { match, markets } = data;
  const num = (value: string) => (value === '' ? null : Number(value));

  const recordResult = async () => {
    setMessage(null);
    try {
      const response = (await adminPost(`/api/v1/admin/matches/${matchId}/result`, {
        status: result.status,
        homeScore: num(result.homeScore), awayScore: num(result.awayScore),
        homeHalfScore: num(result.homeHalfScore), awayHalfScore: num(result.awayHalfScore),
        homeCorners: num(result.homeCorners), awayCorners: num(result.awayCorners),
        homeCards: num(result.homeCards), awayCards: num(result.awayCards),
        extraTime: result.extraTime, penalties: result.penalties, note: result.note || undefined,
      })) as { settlementQueued?: boolean } | undefined;
      // The API reports whether the re-settlement jobs were queued; the operator must see a partial
      // success instead of assuming the bets will settle by themselves.
      setMessage(response?.settlementQueued === false
        ? 'Result revision recorded, but the affected bets could NOT be queued for re-settlement. Nothing was rolled back — check /admin/settlements.'
        : 'Result revision recorded. Affected bets were queued for settlement.');
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'failed');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px]">{match.id}</span>
          <StatusPill status={match.status} />
          <StatusPill status={match.isBettingAvailable ? 'available' : 'suspended'} />
          {match.isLive ? <span className="nova-chip">live</span> : null}
          <span className="nova-chip">{match.sportKey}</span>
          {match.leagueName ? <span className="nova-chip">{match.leagueName}</span> : null}
        </div>
        <h2 className="mt-2 text-base font-semibold">{match.participants?.map((p) => p.name).join(' vs ')}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Score" value={`${match.homeScore ?? '-'} : ${match.awayScore ?? '-'}`} />
          <Stat label="Kick-off" value={formatDateTime(match.scheduledAt, locale)} />
          <Stat label="Authoritative result revision" value={data.result ? `v${data.result.revision} (${data.result.status})` : 'none'} />
          <Stat label="Updated" value={formatDateTime(match.updatedAt, locale)} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Record an authoritative result</h3>
          {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select className="nova-input" value={result.status} onChange={(e) => setResult({ ...result, status: e.target.value })}>
                {['finished', 'cancelled', 'abandoned', 'postponed', 'interrupted', 'corrected'].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </Field>
            <Field label="Note (audited)"><input className="nova-input" value={result.note} onChange={(e) => setResult({ ...result, note: e.target.value })} /></Field>
            {([['homeScore', 'Home score'], ['awayScore', 'Away score'], ['homeHalfScore', 'Home half-time'], ['awayHalfScore', 'Away half-time'],
               ['homeCorners', 'Home corners'], ['awayCorners', 'Away corners'], ['homeCards', 'Home cards'], ['awayCards', 'Away cards']] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className="nova-input" inputMode="numeric" value={result[key]}
                  onChange={(e) => setResult({ ...result, [key]: e.target.value.replace(/[^\d]/g, '') })}
                />
              </Field>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs nova-muted">
            <input type="checkbox" checked={result.extraTime} onChange={(e) => setResult({ ...result, extraTime: e.target.checked })} /> extra time played
          </label>
          <label className="mt-1 flex items-center gap-2 text-xs nova-muted">
            <input type="checkbox" checked={result.penalties} onChange={(e) => setResult({ ...result, penalties: e.target.checked })} /> decided on penalties
          </label>
          <button type="button" className="nova-btn-primary mt-4" onClick={() => void recordResult()}>Save result revision</button>
          <p className="mt-2 text-[11px] nova-muted">
            Each save creates a NEW revision (the previous one stays). Corrections trigger reversal + re-settlement, never
            an overwrite of history.
          </p>
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-semibold">تغییر دستی ضرایب</h3>
          <Field label="Reason for the manual price (min 8 characters, audited)">
            <input className="nova-input" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <p className="mt-2 text-[11px] nova-muted">
            Decimal odds are entered scaled by 10,000 (2.50 → 25000). Customers see the change as OLD → NEW and must accept it.
          </p>
        </Card>
      </div>

      {markets.length === 0 ? (
        <Card><p className="text-xs nova-muted">This match has no markets. With no sports provider configured nothing is generated automatically.</p></Card>
      ) : markets.map((market) => (
        <Card key={market.id} className="!p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-nova-line p-3">
            <strong className="text-sm">{market.nameFa || market.nameEn}</strong>
            <span className="nova-chip">{market.key}</span>
            <span className="nova-chip">v{market.version}</span>
            <StatusPill status={market.status} />
            <span className="ms-auto">
              <AdminAction
                label={market.status === 'suspended' ? 'Resume market' : 'Suspend market'}
                tone={market.status === 'suspended' ? 'primary' : 'danger'}
                confirmText="Suspend/resume this market? The change is versioned and audited."
                onRun={async () => {
                  await adminPost(`/api/v1/admin/markets/${market.id}/suspend`, {
                    suspended: market.status !== 'suspended',
                    reason: reason.length >= 4 ? reason : 'operator trading action',
                  });
                  await reload();
                }}
              />
            </span>
          </div>
          <table className="nova-table">
            <thead><tr><th>انتخاب</th><th>ضریب فعلی</th><th>قبلی</th><th>نسخه</th><th>Status</th><th>تغییر</th></tr></thead>
            <tbody>
              {market.selections.map((selection) => (
                <tr key={selection.id}>
                  <td className="text-xs">{selection.nameFa || selection.nameEn}{selection.line ? ` (${selection.line})` : ''}</td>
                  <td className="text-xs">{formatOddsScaled(selection.oddsScaled)}</td>
                  <td className="text-xs nova-muted">{selection.previousOddsScaled ? formatOddsScaled(selection.previousOddsScaled) : '—'}</td>
                  <td className="text-xs nova-muted">{selection.oddsVersion}</td>
                  <td><StatusPill status={selection.status} /></td>
                  <td>
                    <span className="flex flex-wrap items-center gap-1">
                      <input
                        className="nova-input !w-24 !py-1 text-xs" inputMode="numeric" placeholder="e.g. 25000"
                        value={oddsDraft[selection.id] ?? ''}
                        onChange={(event) => setOddsDraft({ ...oddsDraft, [selection.id]: event.target.value.replace(/[^\d]/g, '') })}
                      />
                      <AdminAction
                        label="Set odds" tone="primary"
                        confirmText="Publish this manual price? It becomes the authoritative price for new bets."
                        onRun={async () => {
                          const value = oddsDraft[selection.id];
                          if (!value) throw new Error('enter scaled odds');
                          if (reason.length < 8) throw new Error('reason must be at least 8 characters');
                          const response = (await adminPost(`/api/v1/admin/selections/${selection.id}/odds`, { oddsScaled: value, reason })) as { historyRecorded?: boolean } | undefined;
                          if (response?.historyRecorded === false) {
                            setMessage('Price published, but its odds-history entry could not be written — the odds audit trail is incomplete for this change.');
                          }
                          await reload();
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
