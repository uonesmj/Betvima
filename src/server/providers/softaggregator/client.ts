import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import { playerPassword, playerUsername } from './contract';

const ENDPOINT = 'https://api.softaggregator.com/api/v1';
// Provider-confirmed allowlisted client signature; Node's default UA can be blocked by Cloudflare.
export const SOFTAGGREGATOR_USER_AGENT = 'BetVima/1.0';

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

/**
 * Optional demo-only operator config, never copied into the repository, APK or
 * server build. Root-owned and group-readable by novaadmin, mode 0640.
 * In particular, this file CANNOT enable real-money wallet callbacks.
 */
type PrivateDemoConfig = {
  enabled?: boolean;
  apiLogin?: string;
  apiPassword?: string;
  playerSecret?: string;
};
const DEMO_CONFIG_PATH = '/etc/betvima/softaggregator-demo.json';

export function parsePrivateDemoConfig(data: unknown): PrivateDemoConfig {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const input = data as Record<string, unknown>;
  return {
    enabled: input.enabled === true,
    apiLogin: typeof input.apiLogin === 'string' && input.apiLogin.length <= 256 ? input.apiLogin : '',
    apiPassword: typeof input.apiPassword === 'string' && input.apiPassword.length <= 1024 ? input.apiPassword : '',
    playerSecret: typeof input.playerSecret === 'string' && input.playerSecret.length >= 32 &&
      input.playerSecret.length <= 512 ? input.playerSecret : '',
  };
}

function privateDemoConfig(): PrivateDemoConfig {
  let fd: number | undefined;
  try {
    fd = openSync(DEMO_CONFIG_PATH, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = fstatSync(fd);
    // Only root-owned, non-group-writable, non-world-accessible regular files.
    if (!info.isFile() || info.uid !== 0 || (info.mode & 0o027) !== 0 ||
        info.size > 8192) return {};
    return parsePrivateDemoConfig(JSON.parse(readFileSync(fd, 'utf8')));
  } catch {
    // No secret file (CI/preview) or wrong permissions => feature stays off.
    return {};
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function requiredEnv() {
  const privateConfig = privateDemoConfig();
  const login = process.env.SOFTAGGREGATOR_API_LOGIN || privateConfig.apiLogin || '';
  const password = process.env.SOFTAGGREGATOR_API_PASSWORD || privateConfig.apiPassword || '';
  if (!login || !password) throw new Error('SOFTAGGREGATOR_NOT_CONFIGURED');
  return { login, password };
}

export function casinoEnabled() {
  return process.env.SOFTAGGREGATOR_ENABLED === 'true' ||
    privateDemoConfig().enabled === true;
}
export function casinoRealMoneyEnabled() {
  // An on-disk demo config can NEVER authorize wagering or wallet callbacks.
  return process.env.SOFTAGGREGATOR_ENABLED === 'true' &&
    process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED === 'true';
}
export function requireCasinoEnabled() {
  if (!casinoEnabled()) throw new Error('CASINO_DISABLED');
}

export async function callSoftAggregator<T>(method: string, values: Record<string, string | number | boolean> = {}): Promise<T> {
  requireCasinoEnabled();
  const { login, password } = requiredEnv();
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': SOFTAGGREGATOR_USER_AGENT },
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
  const playerSecret = process.env.SOFTAGGREGATOR_PLAYER_SECRET || privateDemoConfig().playerSecret || '';
  if (playerSecret.length < 32) throw new Error('SOFTAGGREGATOR_PLAYER_SECRET_NOT_CONFIGURED');
  return {
    user_username: playerUsername(userId),
    user_password: playerPassword(userId, playerSecret),
  };
}

export async function launchCasinoGame(input: {
  userId?: string; gameId: string; demo: boolean; lang: string; device: 'mobile' | 'desktop';
  country?: string;
}): Promise<string> {
  requireCasinoEnabled();
  if (!input.demo && !casinoRealMoneyEnabled()) throw new Error('CASINO_REAL_MONEY_DISABLED');
  const games = await casinoGames();
  const game = games.find((g) => g.id_hash === input.gameId);
  if (!game) throw new Error('CASINO_GAME_NOT_FOUND');
  // Provider confirms some demo titles (including Aviator) have a false catalogue flag.
  // Attempt getGameDemo for any legitimate catalogued game and defer support to the API.
  const base = {
    gameid: input.gameId, currency: 'USD',
    lang: input.lang === 'fa' ? 'en' : 'en', // The provider's documented languages do not include Persian.
    device: input.device, homeurl: 'https://betvima.com',
  };
  // SoftAggregator documents getGameDemo as using the same player credentials
  // as getGame. Ensure the player before either launch. Neither mode can move
  // funds here: wallet debits/credits are handled only by the signed callback.
  if (!input.userId) throw new Error('CASINO_PLAYER_REQUIRED');
  const identity = casinoPlayerIdentity(input.userId);
  await callSoftAggregator('createPlayer', { ...identity, currency: 'USD' });
  // Live supplier response is { error: 0, response: { gameurl: "https://..." } }.
  // Some integrations return response as a direct string; handle both forms.
  // Keep the token-bearing URL server-side until it is returned to its owning user.
  const launch = await callSoftAggregator<string | { gameurl?: unknown }>(
    input.demo ? 'getGameDemo' : 'getGame', {
      ...identity, ...base,
      ...(!input.demo && input.country ? { country: input.country } : {}),
    });
  const url = typeof launch === 'string' ? launch : launch?.gameurl;
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('INVALID_CASINO_LAUNCH_URL');
  const parsed = new URL(url);
  if (parsed.username || parsed.password || !parsed.hostname.includes('.')) throw new Error('INVALID_CASINO_LAUNCH_URL');
  return url;
}
