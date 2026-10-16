/**
 * Display-only sportsbook probabilities.
 *
 * A price is NOT an observed probability or a prediction. We remove the
 * bookmaker overround from complete outcome sets to present an illustrative
 * market-implied estimate. No result here may be used for bet placement,
 * settlement, refunds or wallet operations.
 */
export interface ProbabilitySelection {
  id: string;
  code?: string | null;
  name?: string | null;
  oddsScaled: string;
  status?: string | null;
}
export interface ProbabilityMarket {
  id: string;
  key?: string | null;
  status?: string | null;
  specifier?: string | null;
  isLive?: boolean;
  selections: ProbabilitySelection[];
}
export interface ProbabilityMatch {
  matchId: string;
  status?: string | null;
  minute?: number | null;
  markets: ProbabilityMarket[];
}
export interface ProbabilityPick {
  matchId: string;
  marketId: string;
  selectionId: string;
}
export interface OutcomeProbability {
  win: number;
  lose: number;
  refund: number;
  isLive: boolean;
}
export type MarketSnapshots = Record<string, ProbabilityMatch>;

const isOpen = (status: string | null | undefined): boolean =>
  String(status ?? 'open').toLowerCase() === 'open';

const cleanKey = (value: string | null | undefined): string =>
  String(value ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const hasDraw = (selection: ProbabilitySelection): boolean => {
  const code = cleanKey(selection.code);
  return code === 'DRAW' || code === 'X' ||
    /^(draw|tie|مساوی)$/i.test((selection.name ?? '').trim());
};

const normalized = (market: ProbabilityMarket): Map<string, number> | null => {
  if (!isOpen(market.status) || market.selections.length < 2 ||
      market.selections.length > 3 ||
      market.selections.some((selection) => !isOpen(selection.status))) {
    return null;
  }
  const odds = market.selections.map((selection) => Number(selection.oddsScaled) / 10000);
  if (odds.some((price) => !Number.isFinite(price) || price <= 1 || price > 100000)) return null;
  const implied = odds.map((price) => 1 / price);
  const total = implied.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  return new Map(market.selections.map((selection, index) => [selection.id, implied[index]! / total]));
};

function isHalfPoint(market: ProbabilityMarket): boolean {
  // Only .5 lines cannot push in ordinary full-result totals/handicap markets.
  const text = [market.specifier, ...market.selections.map((s) => s.name ?? '')].join(' ');
  return /(?:^|[^0-9])\d+\.5(?:[^0-9]|$)/.test(text) &&
    !/(?:^|[^0-9])\d+\.(?:0|25|75)(?:[^0-9]|$)/.test(text);
}

function singlePick(pick: ProbabilityPick, match: ProbabilityMatch): OutcomeProbability | null {
  const market = match.markets?.find((m) => m.id === pick.marketId);
  const selection = market?.selections?.find((s) => s.id === pick.selectionId);
  if (!market || !selection) return null;
  const key = cleanKey(market.key);
  const isLive = String(match.status ?? '').toLowerCase() === 'live' && market.isLive !== false;
  const marketPrices = normalized(market);
  if (!marketPrices?.has(selection.id)) return null;

  if (key === 'DRAW_NO_BET' || key === 'DNB') {
    const reference = match.markets.find((m) =>
      m.id !== market.id && m.isLive === market.isLive &&
      ['1X2', 'H2H'].includes(cleanKey(m.key)) &&
      m.selections.length === 3 && m.selections.some(hasDraw));
    if (!reference) return null;
    const fair = normalized(reference);
    if (!fair) return null;
    const draw = reference.selections.find(hasDraw);
    const choice = reference.selections.find((s) =>
      !hasDraw(s) &&
      ((selection.code && cleanKey(selection.code) === cleanKey(s.code)) ||
        (selection.name && selection.name.trim().toLowerCase() === (s.name ?? '').trim().toLowerCase())));
    if (!draw || !choice) return null;
    const win = fair.get(choice.id);
    const refund = fair.get(draw.id);
    if (win == null || refund == null) return null;
    return { win, refund, lose: Math.max(0, 1 - win - refund), isLive };
  }

  const noPushMarket = (
    ((key === '1X2' || key === 'H2H') &&
      (market.selections.length === 2 ||
        (market.selections.length === 3 && market.selections.some(hasDraw)))) ||
    ((key === 'BTTS' || key === 'BOTH_TEAMS_TO_SCORE') && market.selections.length === 2) ||
    ((key === 'TOTALS' || key === 'OVER_UNDER' || key === 'SPREADS' ||
      key === 'HANDICAP') && market.selections.length === 2 && isHalfPoint(market))
  );
  // Non-half-point spreads, Asian lines, DNB without 1X2, and unusual markets
  // have a push/partial-refund possibility we cannot quantify from offered odds.
  if (!noPushMarket) return null;
  const win = marketPrices.get(selection.id)!;
  return { win, lose: 1 - win, refund: 0, isLive };
}

/**
 * Accumulator settlement:
 * - all legs W/V, at least one W => win (void legs are odds 1)
 * - all V => full stake return
 * - any L => lose.
 *
 * This uses independence between legs as an illustration, not a calibrated
 * statistical model. A missing/stale/suspended market fails closed.
 */
export function estimateSlipProbability(
  picks: readonly ProbabilityPick[],
  snapshots: MarketSnapshots,
): OutcomeProbability | null {
  if (!picks.length) return null;
  let noLoss = 1;
  let allRefund = 1;
  let isLive = false;
  for (const pick of picks) {
    const match = snapshots[pick.matchId];
    if (!match || ['finished', 'cancelled', 'abandoned', 'postponed', 'interrupted']
      .includes(String(match.status ?? '').toLowerCase())) return null;
    const outcome = singlePick(pick, match);
    if (!outcome) return null;
    noLoss *= outcome.win + outcome.refund;
    allRefund *= outcome.refund;
    isLive ||= outcome.isLive;
  }
  const refund = Math.min(1, Math.max(0, allRefund));
  const win = Math.min(1, Math.max(0, noLoss - refund));
  return { win, lose: Math.max(0, 1 - win - refund), refund, isLive };
}

/** Rounded percentages whose sum is always exactly 100. */
export function outcomePercents(model: OutcomeProbability): {
  win: number; lose: number; refund: number;
} {
  const raw = [model.win, model.lose, model.refund].map((value) =>
    Math.max(0, Math.min(100, value * 100)));
  const parts = raw.map((value) => Math.floor(value));
  let remaining = 100 - parts.reduce((sum, value) => sum + value, 0);
  const order = [0, 1, 2].sort((a, b) =>
    (raw[b]! - Math.floor(raw[b]!)) - (raw[a]! - Math.floor(raw[a]!)));
  for (let i = 0; i < remaining; i++) parts[order[i % 3]!]! += 1;
  return { win: parts[0]!, lose: parts[1]!, refund: parts[2]! };
}
