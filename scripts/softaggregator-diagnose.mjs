#!/usr/bin/env node
/**
 * Read-only SoftAggregator activation probe.
 * Run on a private server with the operator's API credentials already available
 * in process.env. This file NEVER logs or serializes credentials or launch URLs.
 * No balance callbacks, player registration, deposits, or payments are attempted.
 *
 *   node scripts/softaggregator-diagnose.mjs
 *   SOFTAGGREGATOR_PROBE_GAME_ID='provider/Game' node scripts/softaggregator-diagnose.mjs
 */
const endpoint = 'https://api.softaggregator.com/api/v1';
// This UA has been verified by SoftAggregator to pass its Cloudflare edge.
const userAgent = 'BetVima/1.0';
const login = process.env.SOFTAGGREGATOR_API_LOGIN ?? '';
const password = process.env.SOFTAGGREGATOR_API_PASSWORD ?? '';
const enabled = process.env.SOFTAGGREGATOR_ENABLED === 'true';
const realMoney = process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED === 'true';

function refuse(reason) {
  console.error(JSON.stringify({ ok: false, phase: reason }));
  process.exitCode = 1;
}

async function call(method, fields = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent },
    body: JSON.stringify({ api_login: login, api_password: password, method, ...fields }),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw Error('http');
  const data = await response.json();
  if (!data || data.error !== 0 || !('response' in data)) throw Error('provider_rejected');
  return data.response;
}

async function main() {
  if (!login || !password) return refuse('credentials_missing');
  if (!enabled) return refuse('casino_feature_disabled');
  if (realMoney) return refuse('financial_mode_enabled_refuse_smoke_test');

  let currencies;
  let games;
  try {
    currencies = await call('getCurrencies');
  } catch {
    return refuse('currencies_request_failed');
  }
  if (!currencies || !Array.isArray(currencies.currencies) || !currencies.currencies.includes('USD')) {
    return refuse('usd_currency_not_enabled');
  }
  try {
    games = await call('getGameList');
  } catch {
    return refuse('game_catalogue_failed');
  }
  if (!Array.isArray(games)) return refuse('invalid_game_catalogue');

  const valid = games.filter(item =>
    item && typeof item.id_hash === 'string' && item.id_hash.length > 0 &&
    typeof item.name === 'string' && item.name.length > 0 &&
    typeof item.game_type === 'string' && typeof item.provider === 'string');
  const byCategory = {};
  for (const item of valid) byCategory[item.game_type] = (byCategory[item.game_type] ?? 0) + 1;
  const demoAvailable = valid.filter(g => g.play_for_fun_supported === true);
  if (valid.length === 0) return refuse('zero_licensed_games');

  const gameId = process.env.SOFTAGGREGATOR_PROBE_GAME_ID ?? '';
  if (gameId) {
    const game = valid.find(g => g.id_hash === gameId);
    if (!game) return refuse('demo_game_not_in_catalogue');
    const params = {
      gameid: gameId, lang: 'en', currency: 'USD', device: 'mobile',
      homeurl: 'https://betvima.com',
    };
    if (process.env.SOFTAGGREGATOR_PROBE_USER && process.env.SOFTAGGREGATOR_PROBE_PASSWORD) {
      params.user_username = process.env.SOFTAGGREGATOR_PROBE_USER;
      params.user_password = process.env.SOFTAGGREGATOR_PROBE_PASSWORD;
    }
    let launch;
    try {
      launch = await call('getGameDemo', params);
    } catch {
      return refuse('demo_launch_failed');
    }
    const url = typeof launch === 'string' ? launch : launch?.gameurl;
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      return refuse('invalid_demo_launch_url');
    }
  }

  console.log(JSON.stringify({
    ok: true, currency: 'USD', catalogueTotal: valid.length,
    demoSupported: demoAvailable.length, categories: byCategory,
    demoLaunchTested: Boolean(gameId), realMoneyEnabled: false,
  }));
}
await main().catch(() => refuse('network_or_runtime_failure'));
