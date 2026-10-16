/**
 * Read-only reconciliation of vendor history against our signed callback
 * receipts. All game amounts are USD cents; NEVER compare IRT/IRR wallet units
 * to provider history. This does not post, reverse or repair transactions.
 *
 * The vendor's rolled_back history representation can vary by game: leave
 * such rounds for explicit review instead of manufacturing an equality.
 */

export type ProviderRound = {
  round_id: string;
  gameid: string;
  bet: number | string;
  win: number | string;
  ended_at?: string | null;
  rolled_back?: boolean;
};
export type SignedReceipt = {
  round_id: string;
  game_id: string;
  action: 'credit' | 'debit';
  rollback: boolean;
  amount_minor: string;
};
export type RoundAudit = {
  roundId: string;
  gameId: string;
  status: 'matched' | 'mismatch' | 'missing' | 'skipped';
  reason: string;
  providerBetMinor: string;
  providerWinMinor: string;
  recordedBetMinor: string;
  recordedWinMinor: string;
};

function exactCents(raw: number | string): bigint {
  const value = typeof raw === 'number' && Number.isSafeInteger(raw)
    ? String(raw) : typeof raw === 'string' ? raw : '';
  if (!/^(0|[1-9]\d{0,14})$/.test(value)) throw new Error('CASINO_HISTORY_INVALID_CENTS');
  return BigInt(value);
}

const key = (round: string, game: string) => JSON.stringify([round, game]);

export function compareCasinoHistory(rounds: ProviderRound[], receipts: SignedReceipt[]): RoundAudit[] {
  const byRound = new Map<string, SignedReceipt[]>();
  for (const receipt of receipts) {
    // Supplied only by a successful, signed and committed callback DB row.
    const k = key(receipt.round_id, receipt.game_id);
    byRound.set(k, [...(byRound.get(k) ?? []), receipt]);
  }
  return rounds.map((round) => {
    if (!round.round_id || !round.gameid ||
        round.round_id.length > 240 || round.gameid.length > 240) {
      throw new Error('CASINO_HISTORY_INVALID_ROUND_ID');
    }
    const providerBet = exactCents(round.bet);
    const providerWin = exactCents(round.win);
    const local = byRound.get(key(round.round_id, round.gameid)) ?? [];
    const debits = local.filter((r) => r.action === 'debit' && !r.rollback);
    const credits = local.filter((r) => r.action === 'credit' && !r.rollback);
    const recordedBet = debits.reduce((n, r) => n + exactCents(r.amount_minor), 0n);
    const recordedWin = credits.reduce((n, r) => n + exactCents(r.amount_minor), 0n);
    let status: RoundAudit['status'];
    let reason: string;
    if (round.rolled_back === true || local.some((r) => r.rollback) || !round.ended_at) {
      status = 'skipped';
      reason = 'rollback or unsettled round requires separate review';
    } else if (local.length === 0) {
      status = 'missing';
      reason = 'no signed receipts for provider round';
    } else if (recordedBet !== providerBet || recordedWin !== providerWin) {
      status = 'mismatch';
      reason = 'USD-cent wager/winnings differ from provider';
    } else {
      status = 'matched';
      reason = 'provider and signed callbacks agree';
    }
    return {
      roundId: round.round_id, gameId: round.gameid, status, reason,
      providerBetMinor: providerBet.toString(), providerWinMinor: providerWin.toString(),
      recordedBetMinor: recordedBet.toString(), recordedWinMinor: recordedWin.toString(),
    };
  });
}
