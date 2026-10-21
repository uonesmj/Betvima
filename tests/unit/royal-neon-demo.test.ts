import { describe, expect, it } from 'vitest';
import {
  evaluateGrid,
  INITIAL_GRID,
  randomGrid,
  randomSymbol,
  PAYLINES,
  REEL_COUNT,
  ROW_COUNT,
  SYMBOLS,
  SYMBOL_MULTIPLIERS,
  type ReelGrid,
} from '../../src/lib/casino/royal-neon-demo';

describe('Royal Neon visual demo mathematics (never real money)', () => {
  it('uses 5x3 symbols and exactly 10 unique paylines', () => {
    expect(REEL_COUNT).toBe(5);
    expect(ROW_COUNT).toBe(3);
    expect(PAYLINES).toHaveLength(10);
    expect(new Set(PAYLINES.map((line) => line.join(''))).size).toBe(10);
    expect(PAYLINES.every((line) => line.length === REEL_COUNT && line.every((row) => row >= 0 && row < ROW_COUNT))).toBe(true);
    expect(evaluateGrid(INITIAL_GRID, 10).payout).toBeGreaterThanOrEqual(0);
  });

  it('rejects invalid stakes and malformed grids', () => {
    expect(() => evaluateGrid(INITIAL_GRID, 0)).toThrow();
    expect(() => evaluateGrid(INITIAL_GRID, 13)).toThrow();
    expect(() => evaluateGrid([], 10)).toThrow();
    expect(() => evaluateGrid([['crown']], 10)).toThrow();
  });

  it('generates only declared symbols and fails closed for invalid demo randomness', () => {
    const board = randomGrid(() => .3);
    expect(board).toHaveLength(5);
    expect(board.every((reel) => reel.length === 3 && reel.every((symbol) => SYMBOLS.includes(symbol)))).toBe(true);
    expect(() => randomSymbol(() => 1)).toThrow();
    expect(() => randomSymbol(() => NaN)).toThrow();
  });

  it('pays ten paylines on a screen full of identical symbols', () => {
    const grid: ReelGrid = Array.from({ length: 5 }, () => Array(3).fill('crown') as ('crown')[]);
    const result = evaluateGrid(grid, 20);
    expect(result.wins).toHaveLength(10);
    expect(result.payout).toBe(10 * 2 * SYMBOL_MULTIPLIERS.crown[2]);
    expect(result.wins.every((line) => line.positions.length === 5)).toBe(true);
  });

  it('supports wild substitution on a line', () => {
    const grid: ReelGrid = [
      ['star', 'wild', 'ruby'],
      ['star', 'ruby', 'emerald'],
      ['diamond', 'ruby', 'emerald'],
      ['diamond', 'star', 'emerald'],
      ['crown', 'crown', 'ruby'],
    ];
    const result = evaluateGrid(grid, 10);
    expect(result.wins.some((line) => line.line === 1 && line.symbol === 'ruby' && line.count === 3)).toBe(true);
  });

  it('never pays for a line without three consecutive matching symbols', () => {
    const grid: ReelGrid = [
      ['crown', 'crown', 'crown'],
      ['ruby', 'ruby', 'ruby'],
      ['seven', 'seven', 'seven'],
      ['emerald', 'emerald', 'emerald'],
      ['star', 'star', 'star'],
    ];
    expect(evaluateGrid(grid, 10).wins).toHaveLength(0);
  });
});
