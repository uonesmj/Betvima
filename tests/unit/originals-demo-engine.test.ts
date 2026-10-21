import { describe, expect, it } from 'vitest';
import {
  DEMO_DICE_THEORETICAL_RTP,
  DEMO_SLOTS_THEORETICAL_RTP,
  ORIGINALS_DEMO_GAMES,
  rollDemoDice,
  spinDemoSlots,
  uniformDemoInt,
} from '@/lib/originals/demo-engine';

describe('isolated BetVima Originals play-for-fun engine', () => {
  it('uses only documented demo variants with unique identifiers', () => {
    expect(ORIGINALS_DEMO_GAMES).toHaveLength(6);
    expect(new Set(ORIGINALS_DEMO_GAMES.map((g) => g.id)).size).toBe(6);
    expect(new Set(ORIGINALS_DEMO_GAMES.map((g) => g.engine))).toEqual(new Set(['dice', 'slots']));
  });

  it('uses rejection sampling instead of modulo-bias for a non-power-of-two bound', () => {
    const samples = [0xffffffff, 123];
    let calls = 0;
    expect(uniformDemoInt(100, () => { calls += 1; return samples.shift()!; })).toBe(23);
    expect(calls).toBe(2);
  });

  it('rejects invalid RNG inputs and bounds', () => {
    expect(() => uniformDemoInt(0)).toThrow(RangeError);
    expect(() => uniformDemoInt(5, () => -1)).toThrow(RangeError);
    expect(() => uniformDemoInt(5, () => 0x100000000)).toThrow(RangeError);
  });

  it('dice wins on exactly 48 out of 100 outcomes per direction', () => {
    const lowWins = Array.from({ length: 100 }, (_, n) => rollDemoDice('under', () => n).won).filter(Boolean);
    const highWins = Array.from({ length: 100 }, (_, n) => rollDemoDice('over', () => n).won).filter(Boolean);
    expect(lowWins).toHaveLength(48);
    expect(highWins).toHaveLength(48);
    expect(rollDemoDice('under', () => 48).multiplier).toBe(0);
    expect(rollDemoDice('over', () => 52).multiplier).toBe(2);
    expect(DEMO_DICE_THEORETICAL_RTP).toBe(0.96);
  });

  it('slots pay 15x on exactly four equal triples of 64 combinations', () => {
    const sequences = Array.from({ length: 64 }, (_, n) => [
      Math.floor(n / 16),
      Math.floor(n / 4) % 4,
      n % 4,
    ]);
    const wins = sequences.map((numbers) => {
      const draws = [...numbers];
      return spinDemoSlots(() => draws.shift()!).multiplier;
    }).filter((multiplier) => multiplier === 15);
    expect(wins).toHaveLength(4);
    expect(DEMO_SLOTS_THEORETICAL_RTP).toBe(0.9375);
  });
});
