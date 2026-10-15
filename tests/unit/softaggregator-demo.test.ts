import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casinoGames, launchCasinoGame, SOFTAGGREGATOR_USER_AGENT } from '@/server/providers/softaggregator/client';

describe('SoftAggregator demo-only launch API', () => {
  const original = { ...process.env };
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SOFTAGGREGATOR_ENABLED = 'true';
    process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED = 'false';
    process.env.SOFTAGGREGATOR_API_LOGIN = 'dummy-test-login';
    process.env.SOFTAGGREGATOR_API_PASSWORD = 'dummy-test-password';
    process.env.SOFTAGGREGATOR_PLAYER_SECRET = 'test-secret-at-least-32-characters-long';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...original };
  });

  it('launches a vendor-confirmed demo even when catalogue reports false, with player identity', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const userAgents: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const headers = new Headers(options.headers);
      userAgents.push(headers.get('user-agent') ?? '');
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      calls.push(body);
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'slots',
          provider: 'studio', play_for_fun_supported: false,
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: true, json: async () => ({ error: 0, response: { created: true } }),
      };
      if (body.method === 'getGameDemo') return {
        ok: true, json: async () => ({ error: 0, response: { gameurl: 'https://cdn.provider.test/play?token=random' } }),
      };
      throw new Error('Unexpected provider method: ' + body.method);
    }));

    const list = await casinoGames();
    expect(list).toHaveLength(1);
    const url = await launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: list[0]!.id_hash, demo: true, lang: 'en', device: 'mobile',
    });
    expect(url.startsWith('https://cdn.provider.test/')).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(['getGameList', 'createPlayer', 'getGameDemo']);
    expect(userAgents).toEqual(Array(3).fill(SOFTAGGREGATOR_USER_AGENT));
    expect(calls[1]).toHaveProperty('currency', 'USD');
    expect(calls[1]).toHaveProperty('user_username');
    expect(calls[1]).toHaveProperty('user_password');
    expect(calls[2]).toHaveProperty('user_username', calls[1]!.user_username);
    expect(calls[2]).toHaveProperty('user_password', calls[1]!.user_password);
    expect(calls[2]).toHaveProperty('gameid', 'x887bde40b16350c');
  });


  it('retains compatibility with a direct-string launch response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'crash',
          provider: 'studio', play_for_fun_supported: false,
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: true, json: async () => ({ error: 0, response: { created: true } }),
      };
      if (body.method === 'getGameDemo') return {
        ok: true, json: async () => ({ error: 0, response: 'https://cdn.provider.test/legacy' }),
      };
      throw new Error('Unexpected method');
    }));
    const url = await launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'x887bde40b16350c', demo: true, lang: 'en', device: 'mobile',
    });
    expect(url).toBe('https://cdn.provider.test/legacy');
  });

  it('rejects malformed or insecure gameurl responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'crash',
          provider: 'studio', play_for_fun_supported: false,
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: true, json: async () => ({ error: 0, response: { created: true } }),
      };
      if (body.method === 'getGameDemo') return {
        ok: true, json: async () => ({ error: 0, response: { gameurl: 'http://insecure.test/play' } }),
      };
      throw new Error('Unexpected method');
    }));
    await expect(launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'x887bde40b16350c', demo: true, lang: 'en', device: 'mobile',
    })).rejects.toThrow('INVALID_CASINO_LAUNCH_URL');
  });

  it('refuses real-money game access independently of provider credentials', async () => {
    await expect(launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'studio/demo2026', demo: false, lang: 'en', device: 'mobile',
    })).rejects.toThrow('CASINO_REAL_MONEY_DISABLED');
  });
});
