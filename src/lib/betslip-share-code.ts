import { randomInt } from 'node:crypto';

// Five-character, mixed letter+digit code. Remove ambiguous I/O/0/1 glyphs.
export const SHARE_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const SHARE_CODE_DIGITS = '23456789';
const ALPHABET = SHARE_CODE_LETTERS + SHARE_CODE_DIGITS;
const NEW_CODE = /^(?=[A-HJ-NP-Z2-9]{5}$)(?=.*[A-HJ-NP-Z])(?=.*[2-9])[A-HJ-NP-Z2-9]{5}$/;
const LEGACY_CODE = /^NOVA-[A-HJ-NP-Z2-9]{8}$/;

/** Old previously-shared NOVA codes can still be imported. */
export function isBetSlipShareCode(value: string): boolean {
  const code = value.trim().toUpperCase();
  return NEW_CODE.test(code) || LEGACY_CODE.test(code);
}

/** Cryptographically secure; DB uniqueness is enforced separately by ON CONFLICT. */
export function makeBetSlipShareCode(): string {
  const chars = [
    SHARE_CODE_LETTERS[randomInt(SHARE_CODE_LETTERS.length)],
    SHARE_CODE_DIGITS[randomInt(SHARE_CODE_DIGITS.length)],
    ...Array.from({ length: 3 }, () => ALPHABET[randomInt(ALPHABET.length)]),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
