/**
 * Single public-page metadata probe. NOT a scraper or an odds feed.
 * No credentials, odds capture, persistence, bypass or production writes.
 */
import { pathToFileURL } from 'node:url';
const PUBLIC_ROUTES = new Map([
  ['https://1win.ng', '/betting'],
  ['https://1win.com', '/betting/live'],
]);
const MAX_BYTES = 512 * 1024;
export function robotsDecision(raw, path = '/betting') {
  // Match robots.txt groups according to RFC 9309's longest applicable rule.
  // This routine only governs a metadata probe; robots permission is NOT
  // copyright permission to copy or syndicate odds.
  const groups = [];
  let current = null;
  let sawRule = false;
  for (const line of String(raw).split(/\r?\n/)) {
    const clean = line.split('#')[0].trim();
    const found = /^([a-z-]+)\s*:\s*(.*)$/i.exec(clean);
    if (!found) continue;
    const key = found[1].toLowerCase(), value = found[2].trim();
    if (key === 'user-agent') {
      if (!current || sawRule) {
        current = { agents: [], rules: [] };
        groups.push(current);
        sawRule = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (current && (key === 'allow' || key === 'disallow')) {
      sawRule = true;
      if (value) current.rules.push({ key, path: value });
    }
  }
  const agent = 'BetvimaPublicPageFeasibility'.toLowerCase();
  const matches = groups.flatMap((group) => group.agents
    .filter((a) => a === '*' || agent.startsWith(a))
    .map((a) => ({ specificity: a === '*' ? 0 : a.length, rules: group.rules })));
  const maxSpecificity = matches.reduce((max, m) => Math.max(max, m.specificity), -1);
  const applicable = matches.filter((m) => m.specificity === maxSpecificity)
    .flatMap((m) => m.rules);
  const matching = applicable.filter((rule) => {
    // Support * wildcards and terminal $ anchors without requesting anything.
    const terminal = rule.path.endsWith('$');
    const rawPattern = terminal ? rule.path.slice(0, -1) : rule.path;
    const escaped = rawPattern.split('*').map((part) =>
      part.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + escaped + (terminal ? '$' : '')).test(path);
  }).sort((a, b) =>
    b.path.replace(/[*$]/g, '').length - a.path.replace(/[*$]/g, '').length ||
    (a.key === 'allow' ? -1 : 1));
  const winning = matching[0] ?? null;
  return {
    allowed: !winning || winning.key === 'allow',
    reason: !winning ? 'no_matching_robots_denial' :
      winning.key === 'allow' ? 'robots_explicit_allow' : 'robots_disallow',
    matchedRuleType: winning?.key ?? null,
    matchedRuleLength: winning?.path.length ?? 0,
  };
}
export async function inspectPublicPage({ fetchImpl = fetch, origin = 'https://1win.ng' } = {}) {
  if (!PUBLIC_ROUTES.has(origin)) throw new Error('Domain is not allowlisted');
  const ROBOTS = origin + '/robots.txt';
  const BETTING = origin + PUBLIC_ROUTES.get(origin);
  const request = (url) => fetchImpl(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: { 'user-agent': 'BetvimaPublicPageFeasibility/1.0', accept: 'text/html,text/plain;q=0.5' },
  });
  const report = {
    source: new URL(origin).hostname, mode: 'ONE_SHOT_METADATA_ONLY',
    productionEligible: false, extractionApproved: false,
    status: 'UNTESTED', robotsStatus: null, httpStatus: null,
    contentType: null, bytesRead: 0, truncated: false,
    scriptTagsSeen: 0, hydrationMarkerPresent: false,
    fixtureDataVerified: false, liveUpdatesVerified: false, rightsVerified: false,
  };
  const robots = await request(ROBOTS);
  report.robotsStatus = robots.status;
  if (robots.status === 200) {
    const verdict = robotsDecision((await robots.text()).slice(0, 100000), PUBLIC_ROUTES.get(origin));
    if (!verdict.allowed) {
      report.status = 'STOP_' + verdict.reason.toUpperCase();
      return report;
    }
  } else if (robots.status !== 404) {
    report.status = 'STOP_ROBOTS_NOT_ACCESSIBLE';
    await robots.body?.cancel();
    return report;
  } else await robots.body?.cancel();
  const response = await request(BETTING);
  report.httpStatus = response.status;
  report.contentType = response.headers.get('content-type');
  if (response.status !== 200 || !report.contentType?.toLowerCase().includes('text/html')) {
    report.status = 'PUBLIC_PAGE_NOT_AVAILABLE_AS_HTML';
    await response.body?.cancel();
    return report;
  }
  const reader = response.body?.getReader();
  if (!reader) { report.status = 'EMPTY_RESPONSE_STREAM'; return report; }
  const decoder = new TextDecoder();
  let snippet = '';
  while (report.bytesRead <= MAX_BYTES) {
    const part = await reader.read();
    if (part.done) break;
    report.bytesRead += part.value.byteLength;
    snippet += decoder.decode(part.value, { stream: true });
    if (report.bytesRead > MAX_BYTES) { report.truncated = true; break; }
  }
  await reader.cancel().catch(() => {});
  report.scriptTagsSeen = (snippet.match(/<script\b/gi) ?? []).length;
  report.hydrationMarkerPresent =
    /__NEXT_DATA__|__NUXT__|__INITIAL_STATE__|__APOLLO_STATE__/.test(snippet);
  report.status = 'HTML_METADATA_ONLY_NO_DATA_VALIDATION';
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  inspectPublicPage({ origin: process.env.ONEWIN_PUBLIC_ORIGIN ?? 'https://1win.ng' }).then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }).catch((error) => {
    console.error('Page diagnostic unavailable:', error instanceof Error ? error.name : 'Error');
    process.exitCode = 1;
  });
}
