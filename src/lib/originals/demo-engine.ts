/**
 * BetVima Originals — isolated prototype math.
 *
 * This is ONLY a play-for-fun demo. It neither reads nor writes the BetVima
 * wallet, cannot be redeemed and is NOT a certified real-money RNG.
 * Real-money game results must be determined server-side and independently
 * tested under the applicable licence before any financial integration.
 */
export type DemoEngine = 'slots' | 'dice';
export type DiceDirection = 'under' | 'over';

export type DemoGame = {
  id: string;
  name: string;
  engine: DemoEngine;
  accent: string;
  tagline: string;
};

export const DEMO_STARTING_CREDITS = 1000;
export const DEMO_STAKES = [10, 20, 50, 100] as const;

/** Visual variants share one mathematical engine per type. These are not distinct certified games. */
export const ORIGINALS_DEMO_GAMES: readonly DemoGame[] = [
  { id: 'neon-sevens', name: 'Neon Sevens', engine: 'slots', accent: '#3B82F6', tagline: 'Classic three-reel demo' },
  { id: 'royal-vault', name: 'Royal Vault', engine: 'slots', accent: '#EAB308', tagline: 'Golden reels demo' },
  { id: 'eclipse-reels', name: 'Eclipse Reels', engine: 'slots', accent: '#A78BFA', tagline: 'Midnight reels demo' },
  { id: 'azure-stars', name: 'Azure Stars', engine: 'slots', accent: '#06B6D4', tagline: 'Electric stars demo' },
  { id: 'blue-dice', name: 'Blue Dice', engine: 'dice', accent: '#3B82F6', tagline: 'Under / over demo' },
  { id: 'night-dice', name: 'Night Dice', engine: 'dice', accent: '#A78BFA', tagline: 'Midnight dice demo' },
] as const;

const UINT32_RANGE = 0x100000000;

/** Browser CSPRNG for a non-financial preview, with unbiased rejection sampling. */
function secureUint32(): number {
  if (!globalThis.crypto?.getRandomValues) throw new Error('DEMO_SECURE_RANDOM_UNAVAILABLE');
  const sample = new Uint32Array(1);
  globalThis.crypto.getRandomValues(sample);
  return sample[0];
}

export function uniformDemoInt(bound: number, nextUint32: () => number = secureUint32): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > UINT32_RANGE) {
    throw new RangeError('Invalid random bound');
  }
  const limit = Math.floor(UINT32_RANGE / bound) * bound;
  for (;;) {
    const sample = nextUint32();
    if (!Number.isSafeInteger(sample) || sample < 0 || sample >= UINT32_RANGE) {
      throw new RangeError('Invalid random sample');
    }
    if (sample < limit) return sample % bound;
  }
}

export type DiceRound = {
  kind: 'dice';
  number: number;
  direction: DiceDirection;
  won: boolean;
  multiplier: 0 | 2;
};

export function rollDemoDice(
  direction: DiceDirection,
  nextUint32?: () => number,
): DiceRound {
  if (direction !== 'under' && direction !== 'over') throw new RangeError('Invalid dice direction');
  const number = uniformDemoInt(100, nextUint32);
  const won = direction === 'under' ? number < 48 : number >= 52;
  return { kind: 'dice', number, direction, won, multiplier: won ? 2 : 0 };
}

export const DEMO_REEL_SYMBOLS = ['7', '◆', '★', '✦'] as const;
export type SlotRound = {
  kind: 'slots';
  reels: readonly [number, number, number];
  won: boolean;
  multiplier: 0 | 15;
};

export function spinDemoSlots(nextUint32?: () => number): SlotRound {
  const reels: [number, number, number] = [
    uniformDemoInt(DEMO_REEL_SYMBOLS.length, nextUint32),
    uniformDemoInt(DEMO_REEL_SYMBOLS.length, nextUint32),
    uniformDemoInt(DEMO_REEL_SYMBOLS.length, nextUint32),
  ];
  const won = reels[0] === reels[1] && reels[1] === reels[2];
  return { kind: 'slots', reels, won, multiplier: won ? 15 : 0 };
}

/** Theoretical RTPs for the prototype paytables, not independent certifications. */
export const DEMO_DICE_THEORETICAL_RTP = 0.48 * 2;
export const DEMO_SLOTS_THEORETICAL_RTP = (1 / 16) * 15;
