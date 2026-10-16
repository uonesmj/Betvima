import { describe, expect, it } from 'vitest';
import {
  compareCasinoHistory, type ProviderRound, type SignedReceipt,
} from '@/server/providers/softaggregator/reconcile';

const settled = (overrides: Partial<ProviderRound> = {}): ProviderRound => ({
  round_id: 'round-1', gameid: 'game/special:hash',
  bet: 20, win: 40, ended_at: '2026-10-16 01:00:00',
  rolled_back: false, ...overrides,
});
const receipts = (): SignedReceipt[] => [
  { round_id: 'round-1', game_id: 'game/special:hash', action: 'debit',
    rollback: false, amount_minor: '20' },
  { round_id: 'round-1', game_id: 'game/special:hash', action: 'credit',
    rollback: false, amount_minor: '40' },
];

describe('SoftAggregator USD-cent history reconciliation', () => {
  it('compares multiple callback legs without converting to local wallet units', () => {
    const rows = receipts().concat(
      { round_id: 'round-1', game_id: 'game/special:hash', action: 'debit',
        rollback: false, amount_minor: '5' },
    );
    expect(compareCasinoHistory([settled({ bet: 25 })], rows)[0]).toMatchObject({
      status: 'matched', recordedBetMinor: '25', recordedWinMinor: '40',
    });
  });
  it('detects altered win amount, absence of signed receipt, and wrong game ID', () => {
    expect(compareCasinoHistory([settled({ win: 41 })], receipts())[0]?.status).toBe('mismatch');
    expect(compareCasinoHistory([settled()], [])[0]?.status).toBe('missing');
    expect(compareCasinoHistory([settled({ gameid: 'other-game' })], receipts())[0]?.status).toBe('missing');
  });
  it('does not incorrectly sign off incomplete or rollback rounds', () => {
    expect(compareCasinoHistory([settled({ ended_at: null })], receipts())[0]?.status).toBe('skipped');
    expect(compareCasinoHistory([settled({ rolled_back: true })], receipts())[0]?.status).toBe('skipped');
    const refund: SignedReceipt = {
      round_id: 'round-1', game_id: 'game/special:hash', action: 'credit',
      rollback: true, amount_minor: '20',
    };
    expect(compareCasinoHistory([settled()], [...receipts(), refund])[0]?.status).toBe('skipped');
  });
  it('rejects large unsafe numbers or malformed IDs', () => {
    expect(() => compareCasinoHistory([settled({ bet: Number.MAX_SAFE_INTEGER + 1 })], []))
      .toThrow('CASINO_HISTORY_INVALID_CENTS');
    expect(() => compareCasinoHistory([settled({ round_id: '' })], []))
      .toThrow('CASINO_HISTORY_INVALID_ROUND_ID');
  });
  it('never treats IRT wallet units as USD minor amounts', () => {
    expect(compareCasinoHistory([settled({ bet: 20, win: 40 })], [
      ...receipts().map((r) => ({ ...r, amount_minor: r.action === 'debit' ? '50000' : '100000' })),
    ])[0]?.status).toBe('mismatch');
  });
});
