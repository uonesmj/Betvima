import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import {
  bindCasinoPlayerWallet, isCasinoNativeCurrency, readCasinoPlayerWallet,
} from '@/server/providers/softaggregator/player-wallet-binding';

const player = '00000000-0000-4000-8000-000000000001';

function boundWalletDb(firstPreferred = 'IRT') {
  let preferred = firstPreferred;
  let persisted: string | null = null;
  const queries: string[] = [];
  const db = {
    queryOne: vi.fn(async (sql: string) => {
      if (sql.includes('from nova.profiles')) return { currency: preferred };
      if (sql.includes('from nova.softaggregator_player_wallet_bindings'))
        return persisted ? { wallet_currency: persisted } : null;
      throw new Error('UNEXPECTED_QUERY');
    }),
    query: vi.fn(async (sql: string, args: unknown[]) => {
      queries.push(sql);
      if (sql.includes('insert into nova.softaggregator_player_wallet_bindings')) {
        if (persisted !== null) throw new Error('DUPLICATE_BINDING');
        persisted = String(args[1]);
      }
      return [];
    }),
    transaction: async (fn: (tx: Db) => Promise<unknown>) => fn(db as unknown as Db),
  };
  return {
    db: db as unknown as Db,
    stored: () => persisted,
    queries,
    switchPreference: (currency: string) => { preferred = currency; },
  };
}

describe('casino native-wallet binding / no unintentional currency switch', () => {
  it('binds wallet before first real-money launch and never overwrites the original', async () => {
    const t = boundWalletDb('IRT');
    expect(await readCasinoPlayerWallet(t.db, player)).toBeNull();
    expect(await bindCasinoPlayerWallet(t.db, player, 'IRT')).toBe('IRT');
    expect(t.stored()).toBe('IRT');
    expect(await bindCasinoPlayerWallet(t.db, player, 'IRT')).toBe('IRT');
    expect(t.queries.filter((query) => query.includes('insert into nova.softaggregator_player_wallet_bindings')))
      .toHaveLength(1);
    t.switchPreference('USD');
    expect(await readCasinoPlayerWallet(t.db, player)).toBe('IRT');
    await expect(bindCasinoPlayerWallet(t.db, player, 'USD'))
      .rejects.toThrow('CASINO_WALLET_CURRENCY_LOCKED');
    expect(t.stored()).toBe('IRT');
  });

  it('refuses mismatched or unsupported currencies without creating a record', async () => {
    const t = boundWalletDb('IRT');
    await expect(bindCasinoPlayerWallet(t.db, player, 'IRR'))
      .rejects.toThrow('CASINO_WALLET_CURRENCY_CHANGED');
    await expect(bindCasinoPlayerWallet(t.db, player, 'GBP'))
      .rejects.toThrow('CASINO_WALLET_CURRENCY_UNSUPPORTED');
    expect(t.stored()).toBeNull();
    expect(isCasinoNativeCurrency('USD')).toBe(true);
    expect(isCasinoNativeCurrency('BRL')).toBe(false);
  });

  it('binds the correct rial wallet independently of USD provider denomination', async () => {
    const t = boundWalletDb('IRR');
    expect(await bindCasinoPlayerWallet(t.db, player, 'IRR')).toBe('IRR');
    expect(await readCasinoPlayerWallet(t.db, player)).toBe('IRR');
  });
});
