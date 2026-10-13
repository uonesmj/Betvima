/**
 * Strict Bet365 1X2 quote validation for FiveDollar football.
 *
 * The snapshot API carries *prices* but not authenticated source timestamps.
 * The Ultra history endpoint carries recorded_at for each tick. We require the
 * latest (not merely the latest priced) source tick and an exact snapshot match.
 * Missing, paginated, suspended, old and inconsistent prices never become bets.
 */
import type { ProviderOddsBundle } from '@/lib/ports/providers';

type ObjectRow = Record<string, unknown>;
const object = (v: unknown): ObjectRow | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as ObjectRow : null;
const price = (v: unknown): string | null => {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  const str = String(v).trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(str)) return null;
  const n = Number(str);
  return Number.isFinite(n) && n >= 1.01 && n <= 1000 ? str : null;
};
const LIVE = new Set(['live', 'in_play', '1h', '2h', 'ht', 'halftime', 'extra_time', 'penalties']);
const PRE = new Set(['scheduled', 'not_started']);

export function authenticatedFiveDollarH2h(
  fixtureValue: unknown,
  historyResponse: unknown,
  nowMs = Date.now(),
): ProviderOddsBundle | null {
  const fixture = object(fixtureValue);
  const response = object(historyResponse);
  const history = object(response?.data);
  if (!fixture || !history) return null;
  const fixtureId = String(fixture.id ?? '').trim();
  if (!/^\d{1,20}$/.test(fixtureId)) return null;
  const status = String(fixture.status ?? '').trim().toLowerCase();
  const isLive = LIVE.has(status);
  if (!isLive && !PRE.has(status)) return null;
  if (String(history.fixture_id ?? '') !== fixtureId) return null;
  if (String(history.market ?? '').toLowerCase() !== '1x2') return null;
  const bookmaker = object(history.bookmaker);
  if (String(bookmaker?.slug ?? '').toLowerCase() !== 'bet365') return null;
  const pagination = object(response?.pagination);
  // History pages are oldest-first. Page one is NOT the latest when has_more.
  if (!pagination || pagination.has_more !== false) return null;
  const ticks = history.ticks;
  if (!Array.isArray(ticks) || ticks.length === 0) return null;
  const latest = object(ticks[ticks.length - 1]);
  if (!latest || latest.suspended === true) return null;
  if (isLive && (latest.minute === null || latest.minute === undefined || !Number.isFinite(Number(latest.minute)))) return null;
  if (!isLive && latest.minute !== null && latest.minute !== undefined) return null;
  const sourceMs = Date.parse(String(latest.recorded_at ?? ''));
  if (!Number.isFinite(sourceMs) || sourceMs > nowMs + 15_000 || nowMs - sourceMs > (isLive ? 45_000 : 300_000)) return null;
  const kickoff = Date.parse(String(fixture.kickoff_utc ?? ''));
  if (!Number.isFinite(kickoff) || (isLive ? kickoff > nowMs : kickoff <= nowMs)) return null;

  const odds = object(fixture.odds);
  const h2h = object(odds?.['1x2']);
  const snapshot = object(isLive ? h2h?.inplay : h2h?.closing);
  if (!snapshot) return null;
  const prices: Array<{code: string; name: string; key: string}> = [
    {code:'HOME',name:'Home',key:'home'},
    {code:'DRAW',name:'Draw',key:'draw'},
    {code:'AWAY',name:'Away',key:'away'},
  ];
  const selections = [];
  for (const entry of prices) {
    const snapPrice = price(snapshot[entry.key]);
    const historyPrice = price(latest[entry.key]);
    if (!snapPrice || !historyPrice || Math.abs(Number(snapPrice) - Number(historyPrice)) > 0.0001) return null;
    selections.push({
      providerId: `5dollar:${fixtureId}:bet365:h2h:${entry.code}`,
      code: entry.code, name: entry.name, line: null, odds: snapPrice, status: 'open',
    });
  }
  const authenticatedAt = new Date(sourceMs).toISOString();
  return {
    matchProviderId: fixtureId,
    updatedAt: authenticatedAt,
    markets: [{
      providerId: `5dollar:${fixtureId}:bet365:h2h`,
      key: 'h2h', type: '1X2', specifier: '',
      isLive, status: 'open',
      sourceUpdatedAt: authenticatedAt,
      selections,
    }],
  };
}
