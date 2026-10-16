import { describe, expect, it, vi } from 'vitest';
import { readCompleteCasinoHistory, type CasinoHistoryPage } from '@/server/providers/softaggregator/history-pages';

const round = (n: number) => ({
  round_id: 'round-' + n,
  gameid: 'supplier/real-game',
  bet: 20, win: 15, currency: 'USD',
  ended_at: '2026-10-16 01:00:00',
});

describe('Complete SoftAggregator history before pilot finance reconciliation', () => {
  it('fetches every page, preserving round identity, even above 100 rounds', async () => {
    const data = Array.from({ length: 241 }, (_, i) => round(i));
    const fetchPage = vi.fn(async (limit: number, offset: number): Promise<CasinoHistoryPage> =>
      ({ rounds: data.slice(offset, offset + limit), total: data.length, offset, limit }));
    const result = await readCompleteCasinoHistory(fetchPage, 100);
    expect(result).toHaveLength(241);
    expect(result.at(-1)?.round_id).toBe('round-240');
    expect(fetchPage.mock.calls.map(([_, offset]) => offset)).toEqual([0, 100, 200]);
  });

  it('refuses silent first-page success when supplier has more rounds', async () => {
    const bad = vi.fn(async (_limit: number, offset: number) => ({
      total: 201,
      rounds: offset === 0 ? [round(1)] : [],
    }));
    await expect(readCompleteCasinoHistory(bad, 100))
      .rejects.toThrow('CASINO_HISTORY_PAGE_INCOMPLETE');
  });

  it('refuses duplicate rounds, total drifting, wrong currency, and spoofed offset', async () => {
    await expect(readCompleteCasinoHistory(async () => ({
      total: 2, rounds: [round(1), round(1)],
    }))).rejects.toThrow('CASINO_HISTORY_DUPLICATE_ROUND');

    await expect(readCompleteCasinoHistory(async (_limit, offset) => ({
      total: offset === 0 ? 2 : 3,
      rounds: [round(offset)],
    }), 1)).rejects.toThrow('CASINO_HISTORY_CHANGED_DURING_AUDIT');

    await expect(readCompleteCasinoHistory(async () => ({
      total: 1, rounds: [{ ...round(1), currency: 'IRT' }],
    }))).rejects.toThrow('CASINO_HISTORY_ROUND_INVALID');

    await expect(readCompleteCasinoHistory(async () => ({
      total: 1, rounds: [round(1)], offset: 5,
    }))).rejects.toThrow('CASINO_HISTORY_OFFSET_MISMATCH');
  });

  it('refuses over-limit history and malformed page sizes instead of partially passing', async () => {
    await expect(readCompleteCasinoHistory(async () => ({
      total: 5001, rounds: [round(1)],
    }))).rejects.toThrow('CASINO_HISTORY_PAGE_INVALID');

    await expect(readCompleteCasinoHistory(async () => ({
      total: 1, rounds: [round(1), round(2)],
    }))).rejects.toThrow('CASINO_HISTORY_PAGE_INCOMPLETE');

    expect(await readCompleteCasinoHistory(async () => ({
      total: 0, rounds: [],
    }))).toEqual([]);
  });
});
