import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import {
  CASINO_PILOT_CAPS, pilotCasinoDebitPermitted,
} from '@/server/providers/softaggregator/pilot-limits';

const pilotId = '11111111-1111-4111-8111-111111111111';

function fixture(dailyStake = '0', dailyLoss = '0', weeklyLoss = '0') {
  const queryOne = vi.fn(async (_query: string, _args: unknown[]) => ({
    daily_stake: dailyStake,
    daily_net_loss: dailyLoss,
    weekly_net_loss: weeklyLoss,
  }));
  const db = { queryOne } as unknown as Pick<Db, 'queryOne'>;
  return { db, queryOne };
}

describe('SoftAggregator single-account financial pilot limits', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sets small, fixed USD-cent caps and does not require a global sportsbook limit', () => {
    expect(CASINO_PILOT_CAPS).toMatchObject({
      stakePerBetMinor: 100n,
      dailyStakeMinor: 500n,
      dailyNetLossMinor: 300n,
      weeklyNetLossMinor: 500n,
    });
  });

  it('allows isolated wallet-engine tests without cash authorization to exercise non-pilot flows', async () => {
    vi.stubEnv('SOFTAGGREGATOR_TEST_USER_ID', pilotId);
    const test = fixture();
    expect(await pilotCasinoDebitPermitted(test.db, pilotId, 100n)).toBe(true);
    expect(await pilotCasinoDebitPermitted(test.db,
      '7aa50699-cba1-4767-b7b4-dcd644399816', 10_000n)).toBe(true);
    expect(test.queryOne).toHaveBeenCalledTimes(1);
  });

  it('fails closed for non-pilot users whenever the real-money flag is enabled', async () => {
    vi.stubEnv('SOFTAGGREGATOR_REAL_MONEY_ENABLED', 'true');
    vi.stubEnv('SOFTAGGREGATOR_TEST_USER_ID', pilotId);
    const test = fixture();
    expect(await pilotCasinoDebitPermitted(test.db,
      '7aa50699-cba1-4767-b7b4-dcd644399816', 10n)).toBe(false);
    expect(test.queryOne).not.toHaveBeenCalled();
    expect(await pilotCasinoDebitPermitted(test.db, pilotId, 100n)).toBe(true);
    expect(test.queryOne).toHaveBeenCalledTimes(1);
  });

  it('fails closed if the pilot allowlist is missing while cash is enabled', async () => {
    vi.stubEnv('SOFTAGGREGATOR_REAL_MONEY_ENABLED', 'true');
    vi.stubEnv('SOFTAGGREGATOR_TEST_USER_ID', '');
    const test = fixture();
    expect(await pilotCasinoDebitPermitted(test.db, pilotId, 10n)).toBe(false);
    expect(test.queryOne).not.toHaveBeenCalled();
  });

  it('denies wagers exceeding $1 or crossing $5 daily stakes', async () => {
    vi.stubEnv('SOFTAGGREGATOR_TEST_USER_ID', pilotId);
    const t = fixture('450');
    expect(await pilotCasinoDebitPermitted(t.db, pilotId, 100n)).toBe(false);
    expect(await pilotCasinoDebitPermitted(t.db, pilotId, 50n)).toBe(true);
    expect(await pilotCasinoDebitPermitted(t.db, pilotId, 101n)).toBe(false);
  });

  it('stops wagers when daily or weekly net loss cap is reached', async () => {
    vi.stubEnv('SOFTAGGREGATOR_TEST_USER_ID', pilotId);
    const day = fixture('100', '250', '300');
    expect(await pilotCasinoDebitPermitted(day.db, pilotId, 51n)).toBe(false);
    expect(await pilotCasinoDebitPermitted(day.db, pilotId, 50n)).toBe(true);
    const week = fixture('100', '0', '490');
    expect(await pilotCasinoDebitPermitted(week.db, pilotId, 11n)).toBe(false);
    expect(await pilotCasinoDebitPermitted(week.db, pilotId, 10n)).toBe(true);
  });

  it('counts vendor receipts only, never all sportsbook wallet transactions', async () => {
    vi.stubEnv('SOFTAGGREGATOR_TEST_USER_ID', pilotId);
    const t = fixture();
    expect(await pilotCasinoDebitPermitted(t.db, pilotId, 10n)).toBe(true);
    const sql = String(t.queryOne.mock.calls[0]?.[0]);
    expect(sql).toContain('from nova.softaggregator_callback_receipts');
    expect(sql).toContain('response_error=0');
    expect(sql).not.toContain('from nova.wallet_transactions');
    expect(t.queryOne.mock.calls[0]?.[1]).toEqual([pilotId]);
  });

  it('fails closed if receipt accounting becomes unavailable or malformed', async () => {
    vi.stubEnv('SOFTAGGREGATOR_TEST_USER_ID', pilotId);
    const db = { queryOne: vi.fn(async () => { throw new Error('DB unavailable'); }) } as unknown as Pick<Db, 'queryOne'>;
    expect(await pilotCasinoDebitPermitted(db, pilotId, 10n)).toBe(false);
    const invalid = { queryOne: vi.fn(async () => ({ daily_stake: 'bad', daily_net_loss: '0', weekly_net_loss: '0' })) } as unknown as Pick<Db, 'queryOne'>;
    expect(await pilotCasinoDebitPermitted(invalid, pilotId, 10n)).toBe(false);
  });
});
