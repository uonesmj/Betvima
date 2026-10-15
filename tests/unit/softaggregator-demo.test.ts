import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casinoGames, launchCasinoGame } from '@/server/providers/softaggregator/client';

describe('SoftAggregator demo-only launch API', () => {
  const original = { ...process.env };
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SOFTAGGREGATOR_ENABLED = 'true';
    process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED = 'false';
    process.env.SOFTAGGREGATOR_API_LOGIN = 'dummy-test-login';
    process.env.SOFTAGGREGATOR_API_PASSWORD = 'dummy-test-password';
    delete process.env.SOFTAGGREGATOR_PLAYER_SECRET;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...original };
  });

  it('fetches real catalogue and requests getGameDemo without creating a provider player', async () => {
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      calls.push(body);
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'studio/demo2026', name: 'Demo Game', game_type: 'slots',
          provider: 'studio', play_for_fun_supported: true,
        }] }),
      };
      if (body.method === 'getGameDemo') return {
        ok: true, json: async () => ({ error: 0, response: 'https://cdn.provider.test/play?token=random' }),
      };
      throw new Error('Unexpected provider method: ' + body.method);
    }));

    const list = await casinoGames();
    expect(list).toHaveLength(1);
    const url = await launchCasinoGame({
      gameId: list[0]!.id_hash, demo: true, lang: 'en', device: 'mobile',
    });
    expect(url.startsWith('https://cdn.provider.test/')).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(['getGameList', 'getGameDemo']);
    expect(calls[1]).toHaveProperty('currency', 'USD');
    expect(calls[1]).not.toHaveProperty('user_username');
  });

  it('refuses real-money game access independently of provider credentials', async () => {
    await expect(launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'studio/demo2026', demo: false, lang: 'en', device: 'mobile',
    })).rejects.toThrow('CASINO_REAL_MONEY_DISABLED');
  });
});
