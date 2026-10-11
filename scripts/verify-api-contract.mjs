#!/usr/bin/env node
/**
 * CLIENT/API CONTRACT CHECK
 *
 * Static check that every browser-side API call matches a real route and an exported HTTP method
 * (and that no client calls a path that does not exist). This catches a whole class of bug that
 * type checking cannot see: a component POSTing to an endpoint that only exports PATCH returns
 * 405 at runtime, in the one screen nobody opened manually.
 *
 *   node scripts/verify-api-contract.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const posixPath = (path) => path.replaceAll('\\', '/');

function walk(dir, filter, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

/** route path pattern -> allowed methods */
const routes = new Map();
for (const file of walk(join(root, 'src/app/api'), (f) => f.endsWith('route.ts'))) {
  const url = '/' + posixPath(relative(join(root, 'src/app'), file)).replace(/\/route\.ts$/, '');
  const source = readFileSync(file, 'utf8');
  const methods = new Set([
    ...[...source.matchAll(/export const (GET|POST|PATCH|PUT|DELETE)/g)].map((m) => m[1]),
    // `export async function GET()` is equally valid in the App Router
    ...[...source.matchAll(/export (?:async )?function (GET|POST|PATCH|PUT|DELETE)/g)].map((m) => m[1]),
  ]);
  routes.set(url, methods);
}

const segments = (url) => url.split('/').filter(Boolean);
const isVar = (seg) => seg === '__VAR__' || /^\[[^\]]+\]$/.test(seg);

/**
 * Two URL paths are compatible when they have the same number of segments and every segment
 * matches - either literally or through a dynamic segment on one side ("[id]" in a route file,
 * "${x}" in a client template literal).
 */
function compatible(routeUrl, callUrl) {
  const a = segments(routeUrl);
  const b = segments(callUrl);
  if (a.length !== b.length) return false;
  return a.every((seg, i) => isVar(seg) || isVar(b[i]) || seg === b[i]);
}

function resolveCall(url) {
  const matches = [];
  for (const [route, methods] of routes) {
    if (compatible(route, url)) matches.push({ route, methods });
  }
  if (matches.length === 0) return null;
  return { route: matches.map((m) => m.route).join(' | '), methods: new Set(matches.flatMap((m) => [...m.methods])) };
}

/**
 * CHECK 2 — authorisation before validation.
 *
 * A handler that parses/validates the request body before it resolves the session answers 422
 * (schema feedback) to an anonymous caller instead of 401/503. That leaks the payload contract
 * of a privileged endpoint and is the kind of ordering mistake that is invisible to tsc, lint
 * and the happy-path tests. Protected handlers must call withUser/withAdmin first.
 * Public handlers (auth/session, webhooks, ref tracking) are exempt by path.
 */
const publicPaths = [
  /\/api\/v1\/auth\//,
  /\/api\/v1\/affiliate\/(?:login|register)(?:\/|$)/,
  /\/api\/v1\/betslip\/share(?:\/|$)/,
  /\/api\/webhooks\//,
  /\/api\/v1\/ref\//,
  /\/api\/health/,
];
const mutating = /export const (POST|PATCH|PUT)\s*=/;
const orderingProblems = [];
for (const file of walk(join(root, 'src/app/api'), (f) => f.endsWith('route.ts'))) {
  const url = '/' + posixPath(relative(join(root, 'src/app'), file)).replace(/\/route\.ts$/, '');
  if (publicPaths.some((re) => re.test(url))) continue;
  const source = readFileSync(file, 'utf8');
  if (!mutating.test(source)) continue;
  const handlers = source.split('\nexport const ');
  for (const handler of handlers.slice(1)) {
    const name = handler.split(' ')[0];
    if (!['POST', 'PATCH', 'PUT'].includes(name)) continue;
    const body = handler.slice(0, handler.indexOf('\n});'));
    const validateAt = Math.min(
      ...[body.indexOf('readJson('), body.indexOf('parseJson(')].filter((i) => i !== -1).concat([Number.MAX_SAFE_INTEGER]),
    );
    const guardAt = Math.min(
      ...['withUser(', 'withAdmin(', 'withAffiliate('].map((guard) => body.indexOf(guard)).filter((i) => i !== -1).concat([Number.MAX_SAFE_INTEGER]),
    );
    if (validateAt !== Number.MAX_SAFE_INTEGER && validateAt < guardAt) {
      orderingProblems.push(`${posixPath(relative(root, file))}: ${name} validates the body before resolving the session`);
    }
  }
}

const problems = [];
const checked = [];
for (const file of walk(join(root, 'src'), (f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
  if (posixPath(file).includes('/api/')) continue;
  const text = readFileSync(file, 'utf8');
  const rel = posixPath(relative(root, file));

  const calls = [
    // apiRequest(path, { method: 'X', ... }) / apiRequest(path)
    ...[...text.matchAll(/apiRequest(?:<[^>]*>)?\(\s*[`'"]([^`'"\s]+)[`'"]\s*(?:,\s*\{([\s\S]{0,160}?)\})?\s*\)/g)]
      .map((m) => ({ url: m[1], method: (m[2]?.match(/method:\s*['"]([A-Z]+)['"]/)?.[1]) ?? 'GET' })),
    // adminPost(path, ...) -> POST
    ...[...text.matchAll(/adminPost\(\s*[`'"]([^`'"\s]+)[`'"]/g)].map((m) => ({ url: m[1], method: 'POST' })),
    // useApiQuery<T>(path) -> GET (polls by default)
    ...[...text.matchAll(/useApiQuery<[^>]*>\(\s*[`'"]([^`'"\s]+)[`'"]/g)].map((m) => ({ url: m[1], method: 'GET' })),
  ];

  for (const call of calls) {
    // Template literals produce URLs like `/api/v1/admin/bets/${betId}/settle`; each `${...}`
    // becomes a wildcard segment so the call can still be matched against a real route.
    const url = call.url.split('?')[0].replace(/\$\{[^}]+\}/g, '__VAR__').replace(/__VAR__[^/]*/g, '__VAR__');
    if (!url.startsWith('/api/')) continue;
    const match = resolveCall(url);
    if (!match) { problems.push(`${rel}: ${call.method} ${url} -> no such route`); continue; }
    if (!match.methods.has(call.method)) {
      problems.push(`${rel}: ${call.method} ${url} -> route exports ${[...match.methods].join(',')}`);
      continue;
    }
    checked.push(`${call.method} ${url}`);
  }
}

console.log(`checked ${checked.length} client API call(s) against ${routes.size} routes`);
console.log(`checked authorisation ordering in mutating handlers (violations: ${orderingProblems.length})`);
for (const p of orderingProblems) console.error('  ✗ ' + p);
if (problems.length > 0 || orderingProblems.length > 0) {
  console.error('\nAPI CONTRACT MISMATCHES:');
  for (const p of problems) console.error('  ✗ ' + p);
  process.exit(1);
}
console.log('API CONTRACT OK: every client call matches a route and an exported method; protected handlers authorise before validating');
