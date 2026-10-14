import { describe, expect, it } from 'vitest';
import { isBetSlipShareCode, makeBetSlipShareCode } from '@/lib/betslip-share-code';

describe('BetVima five-character share codes', () => {
  it('always generates five chars with at least one letter and one digit', () => {
    const codes = Array.from({ length: 500 }, () => makeBetSlipShareCode());
    expect(codes.every((code) =>
      /^[A-HJ-NP-Z2-9]{5}$/.test(code) &&
      /[A-HJ-NP-Z]/.test(code) &&
      /[2-9]/.test(code),
    )).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(495);
  });
  it('accepts mixed codes case-insensitively, rejects letters-only and digits-only', () => {
    expect(isBetSlipShareCode(' ab3k7 ')).toBe(true);
    expect(isBetSlipShareCode('2BD9C')).toBe(true);
    expect(isBetSlipShareCode('ABCDE')).toBe(false);
    expect(isBetSlipShareCode('23456')).toBe(false);
    expect(isBetSlipShareCode('AB0K7')).toBe(false);
    expect(isBetSlipShareCode('AB3K78')).toBe(false);
  });
  it('keeps existing NOVA codes valid for old shared slips', () => {
    expect(isBetSlipShareCode('nova-abcdefgh')).toBe(true);
    expect(isBetSlipShareCode('NOVA-23456789')).toBe(true);
    expect(isBetSlipShareCode('NOVA-00000000')).toBe(false);
  });
});
