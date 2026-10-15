import { createHmac } from 'node:crypto';
import { playerPassword, playerUsername } from './contract';

const ENDPOINT = 'https://api.softaggregator.com/api/v1';

type ProviderEnvelope<T> = { error: number; response?: T; message?: string };

export type CasinoGame = {
  id_hash: string;
  name: string;
  game_type: string;
  provider: string;
  provider_name?: string;
  image?: string;
  play_for_fun_supported?: boolean;
};

function requiredEnv() {
  const login = process.env.SOFTAGGREGATOR_API_LOGIN ?? '';
  const password = process.env.SOFTAGGREGATOR_API_PASSWORD ?? '';
  const playerSecret = process.env.SOFTAGGREGATOR_PLAYER_SECRET ?? '';
  if (!login || !password || playerSecret.length < 32) throw new Error('SOFTAGGREGATOR_NOT_CONFIGURED');
  return { login, password, playerSecret };
}

export function casinoEnabled() {
  return process.env.SOFTAGGREGATOR_ENABLED === 'true';
}
export function casinoRealMoneyEnabled() {
  return casinoEnabled() && process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED === 'true';
}
export function requireCasinoEnabled() {
  if (!casinoEnabled()) throw new Error('CASINO_DISABLED');
}

export async function callSoftAggregator<T>(method: string, values: Record<string, string | number | boolean> = {}): Promise<T> {
  requireCasinoEnabled();
  const { login, password } = requiredEnv();
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ api_login: login, api_password: password, method, ...values }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error('SOFTAGGREGATOR_HTTP_ERROR');
  const envelope: ProviderEnvelope<T> = await response.json();
  if (envelope.error !== 0 || envelope.response === undefined) {
    throw new Error('SOFTAGGREGATOR_API_ERROR: ' + String(envelope.message ?? envelope.error).slice(0, 120));
  }
  return envelope.response;
}

type Cache = { games: CasinoGame[]; expires: number };
let cached: Cache | undefined;
export async function casinoGames(): Promise<CasinoGame[]> {
  requireCasinoEnabled();
  if (cached && Date.now() < cached.expires) return cached.games;
  const games = await callSoftAggregator<CasinoGame[]>('getGameList');
  if (!Array.isArray(games)) throw new Error('INVALID_CASINO_CATALOGUE');
  const valid = games.filter((g) => g && typeof g.id_hash === 'string' && g.id_hash.length < 200 &&
    typeof g.name === 'string' && typeof g.provider === 'string' && typeof g.game_type === 'string');
  cached = { games: valid, expires: Date.now() + 300_000 };
  return valid;
}

export function casinoPlayerIdentity(userId: string) {
  const { playerSecret } = requiredEnv();
  return {
    user_username: playerUsername(userId),
    user_password: playerPassword(userId, playerSecret),
  };
}

export async function launchCasinoGame(input: {
  userId: string; gameId: string; demo: boolean; lang: string; device: 'mobile' | 'desktop';
  country?: string;
}): Promise<string> {
  requireCasinoEnabled();
  if (!input.demo && !casinoRealMoneyEnabled()) throw new Error('CASINO_REAL_MONEY_DISABLED');
  const games = await casinoGames();
  const game = games.find((g) => g.id_hash === input.gameId);
  if (!game) throw new Error('CASINO_GAME_NOT_FOUND');
  if (input.demo && !game.play_for_fun_supported) throw new Error('CASINO_DEMO_UNAVAILABLE');
  const identity = casinoPlayerIdentity(input.userId);
  await callSoftAggregator('createPlayer', { ...identity, currency: 'USD' });
  const url = await callSoftAggregator<string>(input.demo ? 'getGameDemo' : 'getGame', {
    ...identity, gameid: input.gameId, currency: 'USD',
    lang: input.lang === 'fa' ? 'fa' : 'en',
    device: input.device, homeurl: 'https://betvima.com',
    ...(input.country ? { country: input.country } : {}),
  });
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('INVALID_CASINO_LAUNCH_URL');
  const parsed = new URL(url);
  if (parsed.username || parsed.password || !parsed.hostname.includes('.')) throw new Error('INVALID_CASINO_LAUNCH_URL');
  return url;
}
