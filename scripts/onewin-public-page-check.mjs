/**
 * Single public-page metadata probe. NOT a scraper or an odds feed.
 * No credentials, odds capture, persistence, bypass or production writes.
 */
import { pathToFileURL } from 'node:url';
const ROBOTS = 'https://1win.ng/robots.txt';
const BETTING = 'https://1win.ng/betting';
const MAX_BYTES = 512 * 1024;
export function robotsDecision(raw, path = '/betting') {
  let wildcard = false;
  const directives = [];
  for (const line of String(raw).split(/\r?\n/)) {
    const clean = line.split('#')[0].trim();
    if (!clean) continue;
    const found = /^([a-z-]+)\s*:\s*(.*)$/i.exec(clean);
    if (!found) continue;
    const key = found[1].toLowerCase(), value = found[2].trim();
    if (key === 'user-agent') wildcard = value === '*';
    else if (wildcard && (key === 'allow' || key === 'disallow') && value)
      directives.push({ key, path: value });
  }
  const denied = directives.some((rule) => rule.key === 'disallow' &&
    !rule.path.includes('*') && !rule.path.includes('$') && path.startsWith(rule.path));
  const unknown = directives.some((rule) => rule.path.includes('*') || rule.path.includes('$'));
  return { allowed: !denied && !unknown, reason:
    denied ? 'robots_disallow' : unknown ? 'complex_robots_rules_require_review' : 'no_matching_robots_denial' };
}
export async function inspectPublicPage({ fetchImpl = fetch } = {}) {
  const request = (url) => fetchImpl(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: { 'user-agent': 'BetvimaPublicPageFeasibility/1.0', accept: 'text/html,text/plain;q=0.5' },
  });
  const report = {
    source: '1win.ng', mode: 'ONE_SHOT_METADATA_ONLY',
    productionEligible: false, extractionApproved: false,
    status: 'UNTESTED', robotsStatus: null, httpStatus: null,
    contentType: null, bytesRead: 0, truncated: false,
    scriptTagsSeen: 0, hydrationMarkerPresent: false,
    fixtureDataVerified: false, liveUpdatesVerified: false, rightsVerified: false,
  };
  const robots = await request(ROBOTS);
  report.robotsStatus = robots.status;
  if (robots.status === 200) {
    const verdict = robotsDecision((await robots.text()).slice(0, 100000));
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
  inspectPublicPage().then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }).catch((error) => {
    console.error('Page diagnostic unavailable:', error instanceof Error ? error.name : 'Error');
    process.exitCode = 1;
  });
}
