import { describe, expect, it } from 'vitest';
import {
  INITIAL_ROYAL_GRID,
  ROYAL_MULTIPLIERS,
  ROYAL_PAYLINES,
  ROYAL_SYMBOLS,
  ROYAL_THEORETICAL_RTP,
  ROYAL_VAULT_MATH_VERSION,
  royalSpin,
  settleRoyalGrid,
} from '@/lib/originals/royal-vault';

describe('Royal Vault demo mathematical rules (not cash certified)', () => {
  it('has five valid three-row paylines and eight different symbols', () => {
    expect(ROYAL_PAYLINES).toHaveLength(5);
    expect(new Set(ROYAL_SYMBOLS).size).toBe(8);
    expect(ROYAL_PAYLINES.every((line) =>
      line.length === 5 && line.every((row) => row >= 0 && row <= 2))).toBe(true);
    expect(ROYAL_VAULT_MATH_VERSION).toBe('rv-demo-1');
  });

  it('uses a fully specified payout table with exact 91.259765625% theoretical RTP', () => {
    expect(ROYAL_MULTIPLIERS).toEqual({ 2: 2, 3: 32, 4: 100, 5: 350 });
    expect(ROYAL_THEORETICAL_RTP).toBeCloseTo(0.91259765625, 14);
  });

  it('does not award wins without consecutive same symbols from reel one', () => {
    const grid = INITIAL_ROYAL_GRID.map((col) => [...col]);
    const result = settleRoyalGrid(grid, 20);
    expect(result.totalAward).toBe(0);
    expect(result.netChange).toBe(-20);
  });

  it('pays 5 of a kind on center line from left to right', () => {
    const grid = INITIAL_ROYAL_GRID.map((col) => [...col]);
    for (let reel = 0; reel < 5; reel += 1) grid[reel]![1] = 'crown';
    const result = settleRoyalGrid(grid, 20);
    const centerWin = result.wins.find((win) => win.line === 2);
    expect(centerWin?.count).toBe(5);
    expect(centerWin?.award).toBe(1400); // 20 / 5 lines * 350
    expect(centerWin?.positions).toHaveLength(5);
    expect(result.totalAward).toBeGreaterThanOrEqual(1400);
  });

  it('pays two of a kind for a matching prefix, not matching suffixes', () => {
    const grid = INITIAL_ROYAL_GRID.map((col) => [...col]);
    grid[1]![1] = 'coin';
    grid[2]![1] = 'ruby';
    const result = settleRoyalGrid(grid, 10);
    expect(result.wins.find((win) => win.line === 2)).toMatchObject({
      count: 2,
      award: 4,
    });
  });

  it('rejects unknown stakes, malformed grids and symbols', () => {
    expect(() => royalSpin(-5)).toThrow('ROYAL_INVALID_DEMO_BET');
    expect(() => settleRoyalGrid(INITIAL_ROYAL_GRID, 2)).toThrow('ROYAL_INVALID_DEMO_BET');
    expect(() => settleRoyalGrid([], 10)).toThrow('ROYAL_INVALID_GRID');
    expect(() => settleRoyalGrid([['fake'] as never, ...INITIAL_ROYAL_GRID.slice(1)], 10)).toThrow('ROYAL_INVALID_GRID');
  });

  it('does not accept injected biased/out-of-range RNG samples', () => {
    expect(() => royalSpin(10, () => -1)).toThrow();
    expect(() => royalSpin(10, () => 0x100000000)).toThrow();
  });

  it('spins exactly 15 random symbols, settles once, and preserves award-bet identity', () => {
    let draws = 0;
    const result = royalSpin(10, () => { draws += 1; return draws - 1; });
    expect(draws).toBe(15);
    expect(result.grid).toHaveLength(5);
    expect(result.grid.every((col) => col.length === 3)).toBe(true);
    expect(result.totalAward - result.bet).toBe(result.netChange);
  });

  it('exhaustively verifies the RTP formula over all 8^5 outcomes for one line', () => {
    let totalMultiplier = 0;
    for (let code = 0; code < 32768; code += 1) {
      let remaining = code;
      const symbols: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        symbols.push(remaining % 8);
        remaining = Math.floor(remaining / 8);
      }
      let run = 1;
      while (run < 5 && symbols[run] === symbols[0]) run += 1;
      if (run >= 2) totalMultiplier += ROYAL_MULTIPLIERS[run as 2 | 3 | 4 | 5];
    }
    expect(totalMultiplier / 32768).toBeCloseTo(ROYAL_THEORETICAL_RTP, 14);
  });
});
