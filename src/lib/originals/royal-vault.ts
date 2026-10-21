import { uniformDemoInt } from './demo-engine';

/**
 * Royal Vault play-for-fun math, version rv-demo-1.
 * Client results/credits are NEVER authoritative financial transactions.
 * Do not use this engine to process real-money bets or payments.
 */
export const ROYAL_VAULT_GAME_ID = 'royal-vault';
export const ROYAL_VAULT_MATH_VERSION = 'rv-demo-1';
export const ROYAL_VAULT_START_CREDITS = 1000;
export const ROYAL_VAULT_BETS = [5, 10, 20, 50, 100] as const;

export const ROYAL_SYMBOLS = [
  'crown', 'diamond', 'key', 'lion', 'coin', 'vault', 'ruby', 'gold',
] as const;
export type RoyalSymbol = (typeof ROYAL_SYMBOLS)[number];
export type RoyalGrid = readonly (readonly RoyalSymbol[])[];

/** A column-major 5×3 grid, with five equally weighted paylines. */
export const ROYAL_PAYLINES: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
] as const;
export const ROYAL_MULTIPLIERS: Readonly<Record<2 | 3 | 4 | 5, number>> = {
  2: 2,
  3: 32,
  4: 100,
  5: 350,
};

/**
 * Exact per-payline theoretical return, using 8 independent equally
 * likely symbols in each cell. No bonus, scatter or hidden features.
 */
export const ROYAL_THEORETICAL_RTP =
  (7 / 64) * ROYAL_MULTIPLIERS[2] +
  (7 / 512) * ROYAL_MULTIPLIERS[3] +
  (7 / 4096) * ROYAL_MULTIPLIERS[4] +
  (1 / 4096) * ROYAL_MULTIPLIERS[5];

export type RoyalLineWin = {
  line: number;
  symbol: RoyalSymbol;
  count: 2 | 3 | 4 | 5;
  multiplier: number;
  award: number;
  positions: readonly { reel: number; row: number }[];
};

export type RoyalRound = {
  version: typeof ROYAL_VAULT_MATH_VERSION;
  grid: RoyalGrid;
  bet: number;
  wins: RoyalLineWin[];
  totalAward: number;
  netChange: number;
};

export const INITIAL_ROYAL_GRID: RoyalGrid = [
  ['crown', 'coin', 'lion'],
  ['diamond', 'gold', 'ruby'],
  ['key', 'vault', 'coin'],
  ['lion', 'diamond', 'crown'],
  ['coin', 'gold', 'key'],
];

export function isRoyalBet(value: number): boolean {
  return ROYAL_VAULT_BETS.some((bet) => bet === value);
}

export function royalSpin(
  bet: number,
  nextUint32?: () => number,
): RoyalRound {
  if (!isRoyalBet(bet)) throw new RangeError('ROYAL_INVALID_DEMO_BET');
  const grid: RoyalSymbol[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () =>
      ROYAL_SYMBOLS[uniformDemoInt(ROYAL_SYMBOLS.length, nextUint32)]!,
    ),
  );
  return settleRoyalGrid(grid, bet);
}

/** Pure evaluator: deterministic for a known grid; useful in math audits. */
export function settleRoyalGrid(grid: RoyalGrid, bet: number): RoyalRound {
  if (!isRoyalBet(bet)) throw new RangeError('ROYAL_INVALID_DEMO_BET');
  if (grid.length !== 5 ||
      grid.some((column) => column.length !== 3 ||
        column.some((symbol) => !ROYAL_SYMBOLS.includes(symbol)))) {
    throw new RangeError('ROYAL_INVALID_GRID');
  }
  const lineBet = bet / ROYAL_PAYLINES.length;
  const wins: RoyalLineWin[] = [];

  for (let line = 0; line < ROYAL_PAYLINES.length; line += 1) {
    const path = ROYAL_PAYLINES[line]!;
    const first = grid[0]![path[0]!]!;
    let count = 1;
    while (count < 5 && grid[count]![path[count]!] === first) count += 1;
    if (count < 2) continue;
    const validCount = count as 2 | 3 | 4 | 5;
    const multiplier = ROYAL_MULTIPLIERS[validCount];
    wins.push({
      line: line + 1,
      symbol: first,
      count: validCount,
      multiplier,
      award: lineBet * multiplier,
      positions: path.slice(0, count).map((row, reel) => ({ reel, row })),
    });
  }

  const totalAward = wins.reduce((sum, win) => sum + win.award, 0);
  return {
    version: ROYAL_VAULT_MATH_VERSION,
    grid,
    bet,
    wins,
    totalAward,
    netChange: totalAward - bet,
  };
}
