import { isBetSlipShareCode } from '@/lib/betslip-share-code';
import { ApiError, withErrorHandling, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/server/http/request';
import { createServices } from '@/server/services/container';

export const dynamic = 'force-dynamic';

type StoredSelection = {
  matchId: string;
  marketId: string;
  selectionId: string;
  label: string;
  marketLabel: string;
  matchLabel: string;
  sportSlug: string;
  oddsScaled: string;
  oddsVersionSeen: number;
};

function availability(snapshot: { matchStatus: string; marketStatus: string; selectionStatus: string }): { available: boolean; reason: string | null } {
  if (['finished', 'cancelled', 'abandoned'].includes(snapshot.matchStatus)) return { available: false, reason: 'MATCH_FINISHED' };
  if (['postponed', 'interrupted'].includes(snapshot.matchStatus)) return { available: false, reason: 'MATCH_UNAVAILABLE' };
  if (['closed', 'settled', 'void'].includes(snapshot.marketStatus)) return { available: false, reason: 'MARKET_CLOSED' };
  if (snapshot.marketStatus === 'suspended') return { available: false, reason: 'MARKET_SUSPENDED' };
  if (snapshot.selectionStatus !== 'open') return { available: false, reason: 'SELECTION_UNAVAILABLE' };
  return { available: true, reason: null };
}

export const GET = withErrorHandling('betslip.share.load', async (ctx, request: Request, routeContext: { params: Promise<{ code: string }> }) => {
  const { code: rawCode } = await routeContext.params;
  const code = rawCode.trim().toUpperCase();
  if (!isBetSlipShareCode(code)) throw new ApiError('BAD_REQUEST', 'Invalid bet slip code');
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  await enforceRateLimit(`betslip-share-load:${ip}`, 60, 60);
  const services = createServices();
  const row = await services.db.queryOne<{ code: string; slip_type: string; currency: string; selections: unknown; created_at: string; expires_at: string | null }>(`select code, slip_type, currency, selections, created_at, expires_at from nova.bet_slip_shares where code = $1 limit 1`, [code]);
  if (row == null) throw new ApiError('NOT_FOUND', 'Bet slip code not found');
  if (row.expires_at != null && new Date(row.expires_at).getTime() <= Date.now()) throw new ApiError('GONE', 'Bet slip code has expired');
  const stored = Array.isArray(row.selections) ? row.selections as StoredSelection[] : [];
  const legs = await Promise.all(stored.map(async (selection) => {
    const snapshots = await services.catalog.getSelectionsForPlacement(selection.matchId, [selection.selectionId]);
    const snapshot = snapshots[0];
    if (snapshot == null || snapshot.marketId !== selection.marketId) return { ...selection, available: false, reason: 'SELECTION_NOT_FOUND', current: null };
    const state = availability(snapshot);
    return { ...selection, available: state.available, reason: state.reason, current: { selectionId: snapshot.selectionId, marketId: snapshot.marketId, matchId: snapshot.matchId, label: snapshot.selectionName, marketLabel: snapshot.marketName, matchLabel: snapshot.matchLabel, oddsScaled: snapshot.oddsScaled.toString(), oddsVersion: snapshot.oddsVersion, scheduledAt: snapshot.scheduledAt, isLive: snapshot.isLive, matchStatus: snapshot.matchStatus, marketStatus: snapshot.marketStatus, selectionStatus: snapshot.selectionStatus } };
  }));
  return jsonOk({ code: row.code, type: row.slip_type, currency: row.currency, createdAt: row.created_at, expiresAt: row.expires_at, legs, availableCount: legs.filter((leg) => leg.available).length, unavailableCount: legs.filter((leg) => leg.available === false).length });
});
