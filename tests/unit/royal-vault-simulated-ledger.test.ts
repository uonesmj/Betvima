import { describe, expect, it } from 'vitest';
import {
  INITIAL_ROYAL_GRID,
  royalSpin,
  settleRoyalGrid,
} from '@/lib/originals/royal-vault';
import { secureRoyalDemoSpin } from '@/server/originals/royal-vault-demo';
import { quoteRoyalSettlement } from '@/server/originals/royal-vault-accounting';
import {
  ELIGIBLE_SIMULATED_ACCOUNT,
  RoyalVaultSimulatedLedger,
} from '@/server/originals/royal-vault-simulated-ledger';

const userId = '20d3d3d3-3e44-4d44-9444-123456789012';
const second = '20d3d3d3-3e44-4d44-9444-123456789013';
const requestId = '49a58a23-4a95-49a5-bc11-123456789012';
const requestTwo = '49a58a23-4a95-49a5-bc11-123456789013';
const lose = () => settleRoyalGrid(INITIAL_ROYAL_GRID, 20);
const win = () => royalSpin(20, () => 0);

describe('Royal Vault isolated round accounting (strictly NOT real money)', () => {
  it('generates a server-origin outcome using the same published paytable', () => {
    const result = secureRoyalDemoSpin(20, () => 0);
    expect(result.grid).toHaveLength(5);
    expect(result.wins).toHaveLength(5);
    expect(result.totalAward).toBe(7_000);
  });

  it('calculates payouts in precise bigint units, ignoring any client-supplied award', () => {
    const round = win();
    const settlement = quoteRoyalSettlement(round, 10n);
    expect(settlement).toMatchObject({
      stakeMinor: 10n,
      paylineMinor: 2n,
      payoutMinor: 3_500n,
      netMinor: 3_490n,
    });
    const manipulatedOutcome = { ...round, totalAward: -999, wins: [] };
    expect(quoteRoyalSettlement(manipulatedOutcome, 10n)).toEqual(settlement);
    expect(() => quoteRoyalSettlement(round, 11n)).toThrow('ROYAL_STAKE_INVALID');
    expect(() => quoteRoyalSettlement({ ...round, version: 'uncertified' as never }, 10n))
      .toThrow('ROYAL_MATH_VERSION_MISMATCH');
  });

  it('debites a virtual stake only once and replays an exact receipt', async () => {
    const ledger = new RoyalVaultSimulatedLedger(lose);
    ledger.seedVirtualAccount(userId, 100n);
    const first = await ledger.simulateSpin({ userId, requestId, stakeMinor: 20n });
    const replay = await ledger.simulateSpin({ userId, requestId, stakeMinor: 20n });
    expect(replay).toBe(first);
    expect(first.balanceAfterMinor).toBe(80n);
    expect(ledger.virtualBalance(userId)).toBe(80n);
    expect(ledger.immutablePostings()).toHaveLength(1);
    expect(ledger.immutablePostings()[0]?.amountMinor).toBe(-20n);
  });

  it('rejects a changed stake on replay without touching previous ledger entries', async () => {
    const ledger = new RoyalVaultSimulatedLedger(lose);
    ledger.seedVirtualAccount(userId, 100n);
    await ledger.simulateSpin({ userId, requestId, stakeMinor: 20n });
    await expect(ledger.simulateSpin({ userId, requestId, stakeMinor: 25n }))
      .rejects.toThrow('SIMULATED_REQUEST_CONFLICT');
    expect(ledger.virtualBalance(userId)).toBe(80n);
    expect(ledger.immutablePostings()).toHaveLength(1);
  });

  it('serializes simultaneous spins so the balance cannot be overspent', async () => {
    const ledger = new RoyalVaultSimulatedLedger(lose);
    ledger.seedVirtualAccount(userId, 10n);
    const attempts = await Promise.allSettled([
      ledger.simulateSpin({ userId, requestId, stakeMinor: 10n }),
      ledger.simulateSpin({ userId, requestId: requestTwo, stakeMinor: 10n }),
    ]);
    expect(attempts.map((item) => item.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(ledger.virtualBalance(userId)).toBe(0n);
    expect(ledger.immutablePostings()).toHaveLength(1);
  });

  it('settles winnings through a separate immutable virtual credit', async () => {
    const ledger = new RoyalVaultSimulatedLedger(win);
    ledger.seedVirtualAccount(userId, 100n);
    const receipt = await ledger.simulateSpin({ userId, requestId, stakeMinor: 10n });
    expect(receipt.balanceAfterMinor).toBe(3_590n);
    expect(ledger.immutablePostings().map((p) => [p.type, p.amountMinor]))
      .toEqual([['stake', -10n], ['payout', 3500n]]);
    expect(ledger.immutablePostings().reduce((sum, post) => sum + post.amountMinor, 100n))
      .toBe(ledger.virtualBalance(userId));
  });

  it('prevents stakes for unapproved, excluded, frozen or inactive simulated accounts', async () => {
    for (const unsafe of [
      { ...ELIGIBLE_SIMULATED_ACCOUNT, ageApproved: false },
      { ...ELIGIBLE_SIMULATED_ACCOUNT, kycApproved: false },
      { ...ELIGIBLE_SIMULATED_ACCOUNT, jurisdictionApproved: false },
      { ...ELIGIBLE_SIMULATED_ACCOUNT, accountActive: false },
      { ...ELIGIBLE_SIMULATED_ACCOUNT, selfExcluded: true },
      { ...ELIGIBLE_SIMULATED_ACCOUNT, frozen: true },
    ]) {
      const ledger = new RoyalVaultSimulatedLedger(lose);
      ledger.seedVirtualAccount(userId, 100n, unsafe);
      await expect(ledger.simulateSpin({ userId, requestId, stakeMinor: 10n }))
        .rejects.toThrow('SIMULATED_ACCOUNT_NOT_ELIGIBLE');
      expect(ledger.virtualBalance(userId)).toBe(100n);
      expect(ledger.immutablePostings()).toHaveLength(0);
    }
  });

  it('keeps a previously settled receipt unchanged after an eligibility change', async () => {
    const ledger = new RoyalVaultSimulatedLedger(lose);
    ledger.seedVirtualAccount(userId, 100n);
    const first = await ledger.simulateSpin({ userId, requestId, stakeMinor: 10n });
    ledger.updateVirtualEligibility(userId, { ...ELIGIBLE_SIMULATED_ACCOUNT, selfExcluded: true });
    const replay = await ledger.simulateSpin({ userId, requestId, stakeMinor: 10n });
    expect(replay).toBe(first);
    expect(ledger.virtualBalance(userId)).toBe(90n);
    await expect(ledger.simulateSpin({ userId, requestId: requestTwo, stakeMinor: 10n }))
      .rejects.toThrow('SIMULATED_ACCOUNT_NOT_ELIGIBLE');
  });

  it('does not debit virtual funds when outcome generation fails', async () => {
    const ledger = new RoyalVaultSimulatedLedger(() => { throw new Error('RNG_BROKEN'); });
    ledger.seedVirtualAccount(userId, 100n);
    await expect(ledger.simulateSpin({ userId, requestId, stakeMinor: 10n }))
      .rejects.toThrow('RNG_BROKEN');
    expect(ledger.virtualBalance(userId)).toBe(100n);
    expect(ledger.immutablePostings()).toHaveLength(0);
  });

  it('isolates each account and rejects invalid request IDs and stakes', async () => {
    const ledger = new RoyalVaultSimulatedLedger(lose);
    ledger.seedVirtualAccount(userId, 100n);
    ledger.seedVirtualAccount(second, 200n);
    await ledger.simulateSpin({ userId, requestId, stakeMinor: 5n });
    expect(ledger.virtualBalance(userId)).toBe(95n);
    expect(ledger.virtualBalance(second)).toBe(200n);
    await expect(ledger.simulateSpin({ userId: second, requestId: 'invalid', stakeMinor: 10n }))
      .rejects.toThrow('SIMULATED_ID_INVALID');
    await expect(ledger.simulateSpin({ userId: second, requestId: requestId, stakeMinor: 3n }))
      .rejects.toThrow('SIMULATED_INVALID_STAKE');
    expect(ledger.virtualBalance(second)).toBe(200n);
  });
});
