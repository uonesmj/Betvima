import { randomBytes } from 'node:crypto';
import { royalSpin, type RoyalRound } from '@/lib/originals/royal-vault';

/**
 * SERVER-OWNED NON-FINANCIAL outcome generator for the Royal Vault demo.
 *
 * Crypto-quality Node RNG; unbiased mapping is provided by uniformDemoInt.
 * This is not an approved real-money implementation. It does not reserve
 * funds, persist rounds, or establish regulatory game/RNG certification.
 */
export function secureRoyalDemoSpin(
  demoCredits: number,
  nextUint32: () => number = () => randomBytes(4).readUInt32BE(0),
): RoyalRound {
  return royalSpin(demoCredits, nextUint32);
}
