import { randomUUID } from 'node:crypto';
import { secureRoyalDemoSpin } from './royal-vault-demo';
import { quoteRoyalSettlement, type RoyalMinorSettlement } from './royal-vault-accounting';
import type { RoyalRound } from '@/lib/originals/royal-vault';

/**
 * Purely isolated, NON-PRODUCTION WALLET SIMULATOR.
 *
 * It demonstrates the financial operation contract with virtual minor units,
 * and is used by tests only. It must NEVER be wired to a production route.
 * Production requires a persistent PostgreSQL journal and independent
 * operator/game certification, eligibility checks and round reconciliation.
 */
export type SimulatedEligibility = Readonly<{
  accountActive: boolean;
  ageApproved: boolean;
  kycApproved: boolean;
  jurisdictionApproved: boolean;
  selfExcluded: boolean;
  frozen: boolean;
}>;
export const ELIGIBLE_SIMULATED_ACCOUNT: SimulatedEligibility = Object.freeze({
  accountActive: true,
  ageApproved: true,
  kycApproved: true,
  jurisdictionApproved: true,
  selfExcluded: false,
  frozen: false,
});
type SimulatedAccount = {
  balanceMinor: bigint;
  eligibility: SimulatedEligibility;
};
export type SimulatedPost = Readonly<{
  roundId: string;
  userId: string;
  type: 'stake' | 'payout';
  amountMinor: bigint;
  balanceAfterMinor: bigint;
}>;
export type SimulatedReceipt = Readonly<{
  roundId: string;
  userId: string;
  requestId: string;
  stakeMinor: bigint;
  balanceAfterMinor: bigint;
  settlement: RoyalMinorSettlement;
  mathOutcome: RoyalRound;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RoyalVaultSimulatedLedger {
  private readonly accounts = new Map<string, SimulatedAccount>();
  private readonly receipts = new Map<string, SimulatedReceipt>();
  private readonly posts: SimulatedPost[] = [];
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly makeRound: () => RoyalRound = () => secureRoyalDemoSpin(20)) {}

  /** Funding is virtual, seeded by isolated tests only. */
  seedVirtualAccount(
    userId: string,
    balanceMinor: bigint,
    eligibility: SimulatedEligibility = ELIGIBLE_SIMULATED_ACCOUNT,
  ) {
    if (!UUID.test(userId) || typeof balanceMinor !== 'bigint' || balanceMinor < 0n ||
      this.accounts.has(userId)) {
      throw new Error('SIMULATED_ACCOUNT_INVALID');
    }
    this.accounts.set(userId, { balanceMinor, eligibility });
  }

  updateVirtualEligibility(userId: string, eligibility: SimulatedEligibility) {
    const current = this.accounts.get(userId);
    if (!current) throw new Error('SIMULATED_ACCOUNT_MISSING');
    current.eligibility = eligibility;
  }

  virtualBalance(userId: string): bigint {
    const account = this.accounts.get(userId);
    if (!account) throw new Error('SIMULATED_ACCOUNT_MISSING');
    return account.balanceMinor;
  }

  immutablePostings(): readonly SimulatedPost[] {
    return this.posts.map((entry) => Object.freeze({ ...entry }));
  }

  /**
   * In tests, serializes each account and atomically publishes an immutable
   * idempotent receipt + debit + payout. No real-money DB is involved.
   */
  async simulateSpin(input: {
    userId: string;
    requestId: string;
    stakeMinor: bigint;
  }): Promise<SimulatedReceipt> {
    const { userId, requestId, stakeMinor } = input;
    if (!UUID.test(userId) || !UUID.test(requestId)) throw new Error('SIMULATED_ID_INVALID');

    const prior = this.locks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const chain = prior.then(() => held);
    this.locks.set(userId, chain);
    await prior;
    try {
      const key = userId + ':' + requestId;
      const duplicate = this.receipts.get(key);
      if (duplicate) {
        if (duplicate.stakeMinor !== stakeMinor) throw new Error('SIMULATED_REQUEST_CONFLICT');
        return duplicate;
      }

      const account = this.accounts.get(userId);
      if (!account) throw new Error('SIMULATED_ACCOUNT_MISSING');
      const e = account.eligibility;
      if (!e.accountActive || !e.ageApproved || !e.kycApproved ||
          !e.jurisdictionApproved || e.selfExcluded || e.frozen) {
        throw new Error('SIMULATED_ACCOUNT_NOT_ELIGIBLE');
      }
      if (typeof stakeMinor !== 'bigint' || stakeMinor < 5n ||
          stakeMinor > 10_000n || stakeMinor % 5n !== 0n) {
        throw new Error('SIMULATED_INVALID_STAKE');
      }
      if (account.balanceMinor < stakeMinor) throw new Error('SIMULATED_INSUFFICIENT_FUNDS');

      // Every throw before this point leaves the account and audit untouched.
      const outcome = this.makeRound();
      const settlement = quoteRoyalSettlement(outcome, stakeMinor);
      const beforeMinor = account.balanceMinor;
      const afterDebitMinor = beforeMinor - stakeMinor;
      const afterMinor = afterDebitMinor + settlement.payoutMinor;
      if (afterMinor < 0n) throw new Error('SIMULATED_NEGATIVE_BALANCE');

      // One synchronous in-memory commit point in tests. Production needs
      // one PostgreSQL transaction with uniqueness + rollback guarantees.
      const roundId = randomUUID();
      const receipt: SimulatedReceipt = Object.freeze({
        roundId, userId, requestId, stakeMinor,
        balanceAfterMinor: afterMinor,
        settlement,
        mathOutcome: outcome,
      });
      const debit: SimulatedPost = Object.freeze({
        roundId, userId, type: 'stake', amountMinor: -stakeMinor,
        balanceAfterMinor: afterDebitMinor,
      });
      const payout: SimulatedPost | null = settlement.payoutMinor > 0n
        ? Object.freeze({
            roundId, userId, type: 'payout',
            amountMinor: settlement.payoutMinor,
            balanceAfterMinor: afterMinor,
          })
        : null;
      account.balanceMinor = afterMinor;
      this.posts.push(debit);
      if (payout) this.posts.push(payout);
      this.receipts.set(key, receipt);
      return receipt;
    } finally {
      release();
      if (this.locks.get(userId) === chain) this.locks.delete(userId);
    }
  }
}
