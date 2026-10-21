/**
 * BetVima Originals: non-financial demo mathematics.
 *
 * IMPORTANT: These functions operate on ephemeral demo credits ONLY.
 * They must never update balances, settle real-money bets, or be treated
 * as audited operator game logic. A real-money implementation needs
 * server-side certified RNG, signed/authenticated round state,
 * idempotent wallet journal entries, and regulatory review.
 */
export const DEMO_STARTING_CENTS = 100_000;
export const DEMO_MAX_BET_CENTS = 20_000;
export const DEMO_MAX_MULTIPLIER = 50;

export const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '🍀', '💎', '7️⃣'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

export const ROULETTE_RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RoulettePick = 'red' | 'black' | 'even' | 'odd' | 'zero';

/** Browser CSPRNG with rejection sampling to avoid modulo bias. */
export function demoRandomIndex(count: number): number {
  if (!Number.isSafeInteger(count) || count < 1 || count > 4_294_967_296) {
    throw new RangeError('INVALID_DEMO_RANDOM_RANGE');
  }
  const space = 4_294_967_296;
  const threshold = Math.floor(space / count) * count;
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= threshold);
  return buffer[0] % count;
}

/** Multiplier generated for an animated client-only demonstration. */
export function demoCrashTarget(randomFraction: number): number {
  if (!Number.isFinite(randomFraction) || randomFraction < 0 || randomFraction >= 1) {
    throw new RangeError('INVALID_DEMO_RANDOM_FRACTION');
  }
  return Math.max(1, Math.min(DEMO_MAX_MULTIPLIER,
    Math.floor((0.99 / (1 - randomFraction)) * 100) / 100));
}

export function demoCrashTargetRandom(): number {
  const value = demoRandomIndex(2 ** 24);
  return demoCrashTarget(value / (2 ** 24));
}

export function demoCrashMultiplier(elapsedMilliseconds: number): number {
  return Math.min(DEMO_MAX_MULTIPLIER,
    Math.max(1, Math.exp(Math.max(0, elapsedMilliseconds) / 7_500)));
}

export function demoRouletteColor(number: number): 'red' | 'black' | 'green' {
  if (!Number.isInteger(number) || number < 0 || number > 36) {
    throw new RangeError('INVALID_ROULETTE_RESULT');
  }
  return number === 0 ? 'green' : ROULETTE_RED_NUMBERS.has(number) ? 'red' : 'black';
}

/** Gross payout multiplier, including original demo stake. */
export function demoRoulettePayout(number: number, pick: RoulettePick): number {
  const color = demoRouletteColor(number);
  if (pick === 'zero') return number === 0 ? 36 : 0;
  if (pick === 'red' || pick === 'black') return color === pick ? 2 : 0;
  if (number === 0) return 0;
  if (pick === 'even') return number % 2 === 0 ? 2 : 0;
  return number % 2 === 1 ? 2 : 0;
}

export function demoSlotPayout(reels: readonly SlotSymbol[]): number {
  if (reels.length !== 3 || reels.some((symbol) => !SLOT_SYMBOLS.includes(symbol))) {
    throw new RangeError('INVALID_SLOT_RESULT');
  }
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    return ({ '🍒': 4, '🍋': 5, '🔔': 6, '🍀': 7, '💎': 12, '7️⃣': 20 } as Record<SlotSymbol, number>)[reels[0]];
  }
  if (reels[0] === '🍒' && reels[1] === '🍒') return 1.5;
  return 0;
}

/** Convert a user-entered demo stake into exact integer cents. */
export function parseDemoStake(input: string, availableCents: number): number | null {
  if (!/^(?:\d{1,6})(?:\.\d{1,2})?$/.test(input.trim())) return null;
  const [whole, fraction = ''] = input.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 100 ||
      cents > DEMO_MAX_BET_CENTS || cents > availableCents) return null;
  return cents;
}
