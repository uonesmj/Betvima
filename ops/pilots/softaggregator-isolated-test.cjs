'use strict';
// Isolated one-account SoftAggregator supplier round test.
// This script does not post to BetVima/Supabase production wallets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');

const APP = process.env.BETVIMA_APP_DIR ||
  '/opt/nova-releases/213b5ca3e6e3537705949a50ce69d7e056680c14';
const NGINX = '/etc/nginx/sites-enabled/betvima.com';
const DATA_DIR = '/var/lib/betvima-casino-pilot';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PID_FILE = path.join(DATA_DIR, 'server.pid');
const BACKUP_DIR = '/var/backups/betvima-nginx';
const PORT = 3109;
const CALLBACK_PATH = '/api/webhooks/softaggregator';
const PILOT_PROXY = 'proxy_pass http://127.0.0.1:3109;';
const ORIGINAL_PROXY = 'proxy_pass http://127.0.0.1:3007;';
const DENIED = { error: 2, balance: 0 };
const PILOT_UUID = 'a326d255-031e-4dc0-8fd1-b63887460250';
const ROOT_UID_REQUIRED = process.getuid && process.getuid() !== 0;

function die(message) { throw new Error(message); }
function log(message) { process.stdout.write(message + '\n'); }
function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' &&
    a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}
function readState() { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
function saveState(state) {
  const tmp = STATE_FILE + '.' + process.pid + '.tmp';
  const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(state) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, STATE_FILE);
  const dirfd = fs.openSync(DATA_DIR, 'r');
  try { fs.fsyncSync(dirfd); } finally { fs.closeSync(dirfd); }
}
function config() {
  process.env.NODE_ENV = 'production';
  const envLoader = require(path.join(APP, 'node_modules/@next/env'));
  envLoader.loadEnvConfig(APP, false);
  const c = {
    login: process.env.SOFTAGGREGATOR_API_LOGIN || '',
    password: process.env.SOFTAGGREGATOR_API_PASSWORD || '',
    salt: process.env.SOFTAGGREGATOR_SALT_KEY || '',
    edge: process.env.SOFTAGGREGATOR_EDGE_HMAC_SECRET || '',
    player: process.env.SOFTAGGREGATOR_PLAYER_SECRET || ''
  };
  if (!c.login || !c.password || c.salt.length < 12 ||
      Buffer.byteLength(c.edge) < 32 || c.player.length < 32) {
    die('MISSING_PROVIDER_OR_CALLBACK_SECRET');
  }
  if (process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED === 'true') {
    die('PRODUCTION_REAL_MONEY_IS_ON__PILOT_REFUSED');
  }
  if (process.env.SOFTAGGREGATOR_TEST_USER_ID !== PILOT_UUID) {
    die('PILOT_ACCOUNT_1112_NOT_CONFIGURED');
  }
  return c;
}
function matchLocation(text) {
  const start = text.indexOf('    location ^~ /api/webhooks/softaggregator {');
  if (start === -1 || text.indexOf('    location ^~ /api/webhooks/softaggregator {', start + 1) !== -1) {
    die('CALLBACK_LOCATION_MISSING_OR_DUPLICATED');
  }
  const end = text.indexOf('\n    }', start);
  if (end === -1) die('CALLBACK_LOCATION_NOT_CLOSED');
  const block = text.slice(start, end + 6);
  if (!block.includes('betvima-casino-cloudflare-ips.conf')) {
    die('CALLBACK_CLOUDFLARE_ORIGIN_FIREWALL_MISSING');
  }
  return { start, end: end + 6, block };
}
function swapProxy(from, to) {
  const target = fs.realpathSync(NGINX);
  const text = fs.readFileSync(target, 'utf8');
  const m = matchLocation(text);
  if (!m.block.includes(from) || m.block.includes(to) ||
      m.block.split(from).length !== 2) {
    die('NGINX_CALLBACK_PROXY_UNEXPECTED__NO_CHANGES');
  }
  const next = text.slice(0, m.start) + m.block.replace(from, to) + text.slice(m.end);
  const stamp = new Date().toISOString().replace(/[:.]/g, '');
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const backup = path.join(BACKUP_DIR, 'betvima-pilot-before-' + stamp + '.conf');
  fs.writeFileSync(backup, text, { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(target, next, { mode: 0o644 });
  try {
    execFileSync('nginx', ['-t'], { stdio: 'pipe' });
    execFileSync('systemctl', ['reload', 'nginx'], { stdio: 'pipe' });
  } catch (err) {
    fs.writeFileSync(target, text, { mode: 0o644 });
    execFileSync('nginx', ['-t'], { stdio: 'pipe' });
    execFileSync('systemctl', ['reload', 'nginx'], { stdio: 'pipe' });
    throw err;
  }
  return backup;
}
function authQuery(url, headers, c) {
  const fields = [...url.searchParams.entries()];
  if (!fields.length || fields.length > 24) return false;
  const names = fields.map(([name]) => name);
  if (new Set(names).size !== names.length ||
      fields.some(([name, value]) => !name || /[&=]/.test(name) || value.includes('&'))) return false;
  const sorted = fields.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const plain = sorted.map(([key, value]) => key + '=' + value).join('&');
  const encoded = new URLSearchParams(sorted).toString();
  if (!equal(hmac(c.salt, plain), headers['x-signature'])) return false;
  if (!equal(hmac(c.edge, encoded), headers['x-betvima-edge-signature'])) return false;
  const timestamp = url.searchParams.get('timestamp') || '';
  if (!/^\d{10}(\d{3})?$/.test(timestamp)) return false;
  const millis = Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
  if (!Number.isSafeInteger(millis) || Math.abs(Date.now() - millis) > 30000) return false;
  const expectedMd5 = crypto.createHash('md5').update(timestamp + c.salt).digest('hex');
  return equal(expectedMd5, url.searchParams.get('key'));
}
function handleCallback(request, c) {
  if (request.method !== 'GET') return DENIED;
  const url = new URL(request.url, 'http://127.0.0.1:' + PORT);
  if (url.pathname !== CALLBACK_PATH || !authQuery(url, request.headers, c)) return DENIED;
  const p = url.searchParams;
  const state = readState();
  if (p.get('username') !== state.username || p.get('currency') !== 'USD') return DENIED;
  const action = p.get('action');
  if (action === 'balance') return { error: 0, balance: state.balance };
  if (action !== 'debit' && action !== 'credit') return DENIED;
  const callId = p.get('call_id') || '';
  const amountText = p.get('amount') || '';
  if (!/^[a-zA-Z0-9_:./-]{1,160}$/.test(callId) ||
      !/^[1-9]\d{0,14}$/.test(amountText)) return DENIED;
  const amount = Number(amountText);
  if (!Number.isSafeInteger(amount) || amount > 1000000000000) return DENIED;
  if (p.has('rb') && p.get('rb') !== '0' && p.get('rb') !== '1') return DENIED;
  const identity = hmac(c.salt, JSON.stringify({
    action, callId, amount, rb: p.get('rb') || '0', game: p.get('game_id') || '',
    round: p.get('round_id') || ''
  }));
  if (state.transactions[callId]) {
    const old = state.transactions[callId];
    return equal(old.identity, identity) ? old.response : DENIED;
  }
  if (action === 'debit' && (amount > 100 || amount > state.balance ||
       state.debitedTotal + amount > 200)) {
    return { error: 1, balance: state.balance };
  }
  if (action === 'debit') {
    state.balance -= amount;
    state.debitedTotal += amount;
  } else {
    state.balance += amount;
  }
  const response = { error: 0, balance: state.balance };
  state.transactions[callId] = {
    identity, response, action, amount, roundId: p.get('round_id') || '',
    gameId: p.get('game_id') || '', rollback: p.get('rb') === '1'
  };
  saveState(state); // durability BEFORE acknowledging a transaction
  return response;
}
function callbackStage(request, c) {
  let url;
  try { url = new URL(request.url, 'http://127.0.0.1:' + PORT); }
  catch { return 'REJECT_URL'; }
  if (request.method !== 'GET' || url.pathname !== CALLBACK_PATH) return 'REJECT_METHOD_PATH';
  const fields = [...url.searchParams.entries()];
  if (!fields.length || fields.length > 24) return 'REJECT_FIELDS';
  const names = fields.map(([name]) => name);
  if (new Set(names).size !== names.length ||
      fields.some(([name, value]) => !name || /[&=]/.test(name) || value.includes('&')))
    return 'REJECT_FIELDS';
  const sorted = fields.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const plain = sorted.map(([key, value]) => key + '=' + value).join('&');
  if (!equal(hmac(c.salt, plain), request.headers['x-signature']))
    return 'REJECT_VENDOR_HMAC';
  if (!equal(hmac(c.edge, new URLSearchParams(sorted).toString()),
      request.headers['x-betvima-edge-signature']))
    return 'REJECT_EDGE_HMAC';
  const p = url.searchParams;
  const timestamp = p.get('timestamp') || '';
  if (!/^\d{10}(\d{3})?$/.test(timestamp)) return 'REJECT_TIMESTAMP';
  const millis = Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
  if (!Number.isSafeInteger(millis) || Math.abs(Date.now() - millis) > 30000)
    return 'REJECT_TIMESTAMP';
  const md5 = crypto.createHash('md5').update(timestamp + c.salt).digest('hex');
  if (!equal(md5, p.get('key'))) return 'REJECT_VENDOR_MD5';
  const state = readState();
  if (p.get('username') !== state.username) return 'REJECT_PLAYER';
  if (p.get('currency') !== 'USD') return 'REJECT_CURRENCY';
  if (!['balance', 'debit', 'credit'].includes(p.get('action')))
    return 'REJECT_ACTION';
  return p.get('action').toUpperCase() + '_AUTH_OK';
}
function traceCallback(request, c) {
  const state = readState();
  const stage = callbackStage(request, c);
  state.callbackStages = state.callbackStages || {};
  state.callbackStages[stage] = (state.callbackStages[stage] || 0) + 1;
  state.lastCallbackStage = stage;
  saveState(state);
  return handleCallback(request, c);
}
function serve() {
  const c = config();
  const server = http.createServer((req, res) => {
    const write = (payload) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(JSON.stringify(payload));
    };
    if (req.method === 'GET' && req.url === '/__health') return write({ ok: true });
    try { return write(traceCallback(req, c)); }
    catch { return write(DENIED); }
  });
  server.listen(PORT, '127.0.0.1');
}
async function api(c, method, extra) {
  const response = await fetch('https://api.softaggregator.com/api/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'BetVima/1.0' },
    body: JSON.stringify({ api_login: c.login, api_password: c.password, method, ...extra }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) die('VENDOR_HTTP_' + response.status);
  const envelope = await response.json();
  if (envelope.error !== 0) {
    die('VENDOR_' + method + '_' + String(envelope.message || envelope.error).slice(0, 100));
  }
  return envelope.response;
}
function identity(c, state) {
  return {
    user_username: state.username,
    user_password: hmac(c.player, 'isolated-casino-pilot:' + state.username)
  };
}
async function start() {
  const c = config();
  if (fs.existsSync(STATE_FILE)) die('PILOT_ALREADY_EXISTS__USE_STATUS_OR_FINISH');
  const conf = fs.readFileSync(fs.realpathSync(NGINX), 'utf8');
  if (!matchLocation(conf).block.includes(ORIGINAL_PROXY)) {
    die('PRODUCTION_CALLBACK_PROXY_NOT_EXPECTED');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  fs.chmodSync(DATA_DIR, 0o700);
  const state = {
    account: 1112,
    username: 'btv_test1112_' + crypto.randomBytes(6).toString('hex'),
    balance: 200, debitedTotal: 0, transactions: {},
    createdAt: new Date().toISOString(), country: 'IR',
    gameId: null, launched: false
  };
  saveState(state);
  const child = spawn(process.execPath, [__filename, 'serve'], {
    detached: true, stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid), { mode: 0o600 });
  let started = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/__health',
        { signal: AbortSignal.timeout(400) });
      if (r.ok) { started = true; break; }
    } catch {}
  }
  if (!started) die('PILOT_SERVER_START_FAILED');
  let routed = false;
  try {
    const backup = swapProxy(ORIGINAL_PROXY, PILOT_PROXY);
    routed = true;
    log('NGINX_ISOLATED_CALLBACK=READY');
    log('NGINX_BACKUP=' + backup);
    const player = identity(c, state);
    await api(c, 'createPlayer', { ...player, currency: 'USD' });
    log('VENDOR_CREATE_PLAYER=OK');
    const games = await api(c, 'getGameList', {});
    if (!Array.isArray(games)) die('INVALID_GAME_CATALOGUE');
    const seen = new Set();
    const choices = games.filter(g => g && g.game_type === 'slots' &&
      typeof g.id_hash === 'string' && typeof g.provider === 'string')
      .filter(g => { if (seen.has(g.provider)) return false; seen.add(g.provider); return true; })
      .slice(0, 8);
    if (!choices.length) die('NO_SLOT_GAMES');
    let gameUrl = null;
    const failures = [];
    for (const game of choices) {
      try {
        const result = await api(c, 'getGame', {
          ...player, gameid: game.id_hash, lang: 'en', currency: 'USD',
          device: 'mobile', country: 'IR', homeurl: 'https://betvima.com/casino'
        });
        const candidate = typeof result === 'string' ? result : result && result.gameurl;
        if (typeof candidate === 'string' && candidate.startsWith('https://')) {
          const parsed = new URL(candidate);
          if (parsed.username || parsed.password) continue;
          gameUrl = candidate;
          state.gameId = game.id_hash;
          state.gameName = String(game.name || '').slice(0, 100);
          state.launched = true;
          saveState(state);
          break;
        }
      } catch (e) {
        failures.push(String(e.message).slice(0, 90));
      }
    }
    if (!gameUrl) die('VENDOR_GETGAME_NOT_AVAILABLE_IR: ' + failures.slice(0, 2).join(' | '));
    log('PILOT_ACCOUNT=1112');
    log('PILOT_CURRENCY=USD');
    log('PILOT_COUNTRY=IR');
    log('PILOT_TEST_CREDIT=2.00');
    log('PILOT_GAME=' + state.gameName);
    log('OPEN_THIS_LINK_PRIVATELY=' + gameUrl);
    log('PLAY_ONE_OR_TWO_ROUNDS_THEN_RUN_STATUS');
  } catch (error) {
    if (routed) {
      try { swapProxy(PILOT_PROXY, ORIGINAL_PROXY); }
      catch { log('CRITICAL_MANUAL_NGINX_RESTORE_REQUIRED'); }
    }
    try { process.kill(child.pid, 'SIGTERM'); } catch {}
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    if (!routed || matchLocation(fs.readFileSync(fs.realpathSync(NGINX), 'utf8')).block.includes(ORIGINAL_PROXY)) {
      if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
    }
    throw error;
  }
}
async function status() {
  const c = config();
  const state = readState();
  const local = Object.values(state.transactions);
  const debit = local.filter(t => t.action === 'debit').reduce((a, t) => a + t.amount, 0);
  const credit = local.filter(t => t.action === 'credit').reduce((a, t) => a + t.amount, 0);
  log('CALLBACK_STAGES=' + JSON.stringify(state.callbackStages || {}));
  log('LAST_CALLBACK_STAGE=' + (state.lastCallbackStage || 'NONE'));
  log('LOCAL_SIGNED_CALLBACKS=' + local.length);
  log('LOCAL_DEBITS_CENTS=' + debit);
  log('LOCAL_CREDITS_CENTS=' + credit);
  log('LOCAL_BALANCE_CENTS=' + state.balance);
  const response = await api(c, 'getPlayerHistory', {
    user_username: state.username, limit: 50, offset: 0
  });
  const rounds = response && Array.isArray(response.rounds) ? response.rounds : [];
  log('PROVIDER_ROUNDS=' + rounds.length);
  const indexed = new Map();
  for (const t of local) {
    if (!t.roundId) continue;
    const v = indexed.get(t.roundId) || { bet: 0, win: 0 };
    if (t.action === 'debit') v.bet += t.amount;
    else v.win += t.amount;
    indexed.set(t.roundId, v);
  }
  const comparable = rounds.filter(r => indexed.has(String(r.round_id)));
  const matched = comparable.length > 0 && comparable.every(r => {
    const t = indexed.get(String(r.round_id));
    return Number(r.bet) === t.bet && Number(r.win) === t.win;
  });
  log('LEDGER_HISTORY_RECONCILIATION=' +
    (matched ? 'MATCH' : (rounds.length === 0 ? 'AWAITING_FIRST_ROUND' : 'NEEDS_REVIEW')));
  log('PILOT_REAL_MONEY_PRODUCTION=OFF');
  log('PILOT_TEST_FUNDS_WITHDRAWABLE=NO');
}
function finish() {
  const state = readState();
  if (!state) die('NO_PILOT');
  const current = matchLocation(fs.readFileSync(fs.realpathSync(NGINX), 'utf8')).block;
  if (current.includes(PILOT_PROXY)) swapProxy(PILOT_PROXY, ORIGINAL_PROXY);
  else if (!current.includes(ORIGINAL_PROXY)) die('UNKNOWN_NGINX_CALLBACK_ROUTE__MANUAL_REVIEW');
  if (fs.existsSync(PID_FILE)) {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8'));
    if (Number.isSafeInteger(pid) && pid > 1) {
      try { process.kill(pid, 'SIGTERM'); } catch {}
    }
    fs.unlinkSync(PID_FILE);
  }
  const archive = path.join(DATA_DIR, 'completed-' +
    new Date().toISOString().replace(/[:.]/g, '') + '.json');
  fs.renameSync(STATE_FILE, archive);
  fs.chmodSync(archive, 0o600);
  log('PILOT_STOPPED=YES');
  log('NORMAL_CALLBACK_ROUTING=RESTORED');
  log('PILOT_HISTORY_ARCHIVE=' + archive);
  log('PRODUCTION_REAL_MONEY=UNCHANGED_OFF');
}
function inspectExistingCallback() {
  const c = config();
  const state = readState();
  const logFile = '/var/log/nginx/access.log';
  const lines = execFileSync('tail', ['-n', '25000', logFile], {
    encoding: 'utf8', maxBuffer: 12 * 1024 * 1024
  }).split('\n');
  const found = [];
  for (const line of lines) {
    if (!line.includes(CALLBACK_PATH)) continue;
    const match = line.match(/"(?:GET|POST) ([^ ]+) HTTP\/[0-9.]+"/);
    if (!match) continue;
    let u;
    try { u = new URL(match[1], 'http://localhost'); } catch { continue; }
    if (u.pathname === CALLBACK_PATH && u.searchParams.get('username') === state.username)
      found.push({ line, u });
  }
  log('PILOT_CALLBACK_LOG_COUNT=' + found.length);
  if (!found.length) return;
  const { u, line } = found[found.length - 1];
  const p = u.searchParams;
  const timestamp = p.get('timestamp') || '';
  const key = p.get('key') || '';
  const matchKey = /^\d{10}(\d{3})?$/.test(timestamp) &&
    equal(crypto.createHash('md5').update(timestamp + c.salt).digest('hex'), key);
  const statusMatch = line.match(/" [0-9]{3} /);
  log('LAST_PILOT_ACTION=' + String(p.get('action') || 'NONE').slice(0, 12));
  log('LAST_PILOT_CURRENCY_MATCH=' + (p.get('currency') === 'USD'));
  log('LAST_PILOT_TIMESTAMP_KEY_MATCH=' + matchKey);
  log('LAST_PILOT_HTTP=' + (statusMatch ? statusMatch[0].trim() : 'UNKNOWN'));
  const now = Math.floor(Date.now() / 1000);
  const probe = new URLSearchParams({
    action: 'balance', username: state.username, currency: 'USD',
    call_id: 'local_probe_' + now, timestamp: String(now),
    key: crypto.createHash('md5').update(String(now) + c.salt).digest('hex')
  });
  const sorted = [...probe.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const headers = {
    'x-signature': hmac(c.salt, sorted.map(([k, v]) => k + '=' + v).join('&')),
    'x-betvima-edge-signature': hmac(c.edge, new URLSearchParams(sorted).toString())
  };
  const result = handleCallback({
    method: 'GET', url: CALLBACK_PATH + '?' + probe.toString(), headers
  }, c);
  log('LOCAL_DUAL_SIGNATURE_BALANCE_TEST=' +
    (result.error === 0 && result.balance === state.balance ? 'PASS' : 'FAIL'));
}
async function restartServer() {
  config();
  readState();
  const m = matchLocation(fs.readFileSync(fs.realpathSync(NGINX), 'utf8'));
  if (!m.block.includes(PILOT_PROXY)) die('CALLBACK_NOT_ROUTED_TO_PILOT');
  if (fs.existsSync(PID_FILE)) {
    const old = Number(fs.readFileSync(PID_FILE, 'utf8'));
    if (Number.isSafeInteger(old) && old > 1) {
      try { process.kill(old, 'SIGTERM'); } catch {}
    }
  }
  let closed = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    try { await fetch('http://127.0.0.1:' + PORT + '/__health',
      { signal: AbortSignal.timeout(250) }); }
    catch { closed = true; break; }
  }
  if (!closed) die('OLD_PILOT_SERVER_DID_NOT_STOP');
  const child = spawn(process.execPath, [__filename, 'serve'], {
    detached: true, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production' }
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid), { mode: 0o600 });
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/__health',
        { signal: AbortSignal.timeout(300) });
      if (r.ok) { ready = true; break; }
    } catch {}
  }
  if (!ready) die('NEW_PILOT_SERVER_FAILED');
  log('PILOT_SERVER_RESTARTED=YES');
  log('CURRENT_GAME_SESSION_PRESERVED=YES');
  log('REOPEN_EXISTING_GAME_AND_RUN_STATUS');
}
async function main() {
  if (ROOT_UID_REQUIRED) die('RUN_AS_ROOT_VIA_SUDO');
  const cmd = process.argv[2];
  if (cmd === 'serve') return serve();
  if (cmd === 'start') return start();
  if (cmd === 'status') return status();
  if (cmd === 'inspect') return inspectExistingCallback();
  if (cmd === 'restart') return restartServer();
  if (cmd === 'finish') return finish();
  die('USAGE: node softaggregator-isolated-test.cjs start|status|inspect|restart|finish');
}
main().catch(err => {
  log('RESULT=FAILED');
  log('ERROR=' + String(err.message || err).slice(0, 170));
  process.exitCode = 1;
});
