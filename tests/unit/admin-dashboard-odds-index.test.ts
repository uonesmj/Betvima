import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import { PostgresAdminRepository } from '@/server/adapters/postgres/admin';

vi.mock('@/server/env', () => ({
  serverEnv: () => ({ SPORTS_PROVIDER: 'the_odds_api', PAYMENT_PROVIDER: 'nowpayments' }),
}));

async function loadDashboard(lastOddsAt: string | null) {
  const query = vi.fn().mockResolvedValue([]);
  const queryOne = vi.fn().mockResolvedValue({
    users_total: '4',
    bets_count: '2',
    last_odds_at: lastOddsAt,
  });
  const db = { query, queryOne } as unknown as Db;
  const metrics = await new PostgresAdminRepository(db).dashboard('24h');
  return { metrics, query, queryOne };
}

describe('admin dashboard last odds sync performance', () => {
  it('uses the existing indexed accepted-ingestion ordering instead of a full history MAX scan', async () => {
    const { metrics, queryOne, query } = await loadDashboard('2026-10-28T14:20:00.000Z');
    const [sql] = queryOne.mock.calls[0] as [string];

    expect(sql).toMatch(/select ingested_at from nova\.odds_history\s+where rejected = false\s+order by ingested_at desc\s+limit 1/i);
    expect(sql).not.toMatch(/max\(provider_timestamp\).*nova\.odds_history/i);
    expect(metrics.providers.lastOddsSyncAt).toBe('2026-10-28T14:20:00.000Z');

    // The existing finance, user and wager metrics remain unchanged.
    expect(metrics.users.total).toBe(4);
    expect(metrics.betting.bets24h).toBe(2);
    expect(metrics.betting.stake24hMinor).toBe(0n);
    expect(metrics.wallet.deposits24hMinor).toBe(0n);
    expect(query).toHaveBeenCalledTimes(9);
  });

  it('returns null when no accepted quote has ever been ingested', async () => {
    const { metrics } = await loadDashboard(null);
    expect(metrics.providers.lastOddsSyncAt).toBeNull();
  });
});
