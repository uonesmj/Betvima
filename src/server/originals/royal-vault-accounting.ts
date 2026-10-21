import {
  ROYAL_PAYLINES,
  ROYAL_VAULT_MATH_VERSION,
  settleRoyalGrid,
  type RoyalRound,
} from '@/lib/originals/royal-vault';

/**
 * Financial arithmetic contract for a future regulated implementation.
 * There is NO production money path to this helper.
 *
 * All numbers are bigint minor units, never floating-point dollars or rials.
 * A stake is evenly split across the five fixed paylines.
 */
export type RoyalMinorSettlement = Readonly<{
  stakeMinor: bigint;
  payoutMinor: bigint;
  netMinor: bigint;
  paylineMinor: bigint;
  mathVersion: typeof ROYAL_VAULT_MATH_VERSION;
}>;

export function quoteRoyalSettlement(
  outcome: Pick<RoyalRound, 'grid' | 'version'>,
  stakeMinor: bigint,
): RoyalMinorSettlement {
  if (typeof stakeMinor !== 'bigint' || stakeMinor < 5n ||
      stakeMinor > 10_000n || stakeMinor % 5n !== 0n) {
    throw new RangeError('ROYAL_STAKE_INVALID');
  }
  if (outcome.version !== ROYAL_VAULT_MATH_VERSION) {
    throw new RangeError('ROYAL_MATH_VERSION_MISMATCH');
  }
  // Re-evaluate the public paytable. Caller-supplied win/payout amounts are ignored.
  const verified = settleRoyalGrid(outcome.grid, 20);
  const paylineMinor = stakeMinor / BigInt(ROYAL_PAYLINES.length);
  const payoutMinor = verified.wins.reduce(
    (sum, win) => sum + paylineMinor * BigInt(win.multiplier), 0n,
  );
  return Object.freeze({
    stakeMinor,
    paylineMinor,
    payoutMinor,
    netMinor: payoutMinor - stakeMinor,
    mathVersion: ROYAL_VAULT_MATH_VERSION,
  });
}
