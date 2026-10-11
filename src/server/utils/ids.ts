import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '@/domain/ports';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const cryptoIds: IdGenerator = {
  uuid: () => randomUUID(),
  publicId: (prefix: string) => {
    let out = '';
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
    return `${prefix}-${out}`;
  },
};

export const newCorrelationId = (): string => `cor_${randomUUID()}`;
