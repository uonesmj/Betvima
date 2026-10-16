import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublicPage, robotsDecision } from '../../scripts/onewin-public-page-check.mjs';
test('robots deny a blocked public page', () => {
  assert.equal(robotsDecision('User-agent: *\nDisallow: /betting').allowed, false);
  assert.equal(robotsDecision('User-agent: *\nDisallow: /').allowed, false);
  assert.equal(robotsDecision('User-agent: *\nDisallow: /private').allowed, true);
  assert.equal(robotsDecision('User-agent: *\nDisallow: /*').allowed, false);
});
test('blocked robots prevents any request to betting page', async () => {
  const calls = [];
  const result = await inspectPublicPage({ fetchImpl: async (url) => {
    calls.push(url);
    return new Response('User-agent: *\nDisallow: /', { status: 200 });
  }});
  assert.deepEqual(calls, ['https://1win.ng/robots.txt']);
  assert.equal(result.status, 'STOP_ROBOTS_DISALLOW');
  assert.equal(result.productionEligible, false);
});
test('one public-page GET yields only metadata, never any odds', async () => {
  const calls = [];
  const html = '<html><head><script>window.__NEXT_DATA__={}</script></head><body>2.45</body></html>';
  const result = await inspectPublicPage({ fetchImpl: async (url) => {
    calls.push(url);
    if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  }});
  assert.deepEqual(calls, ['https://1win.ng/robots.txt', 'https://1win.ng/betting']);
  assert.equal(result.hydrationMarkerPresent, true);
  assert.equal(result.scriptTagsSeen, 1);
  assert.equal(result.fixtureDataVerified, false);
  assert.equal(result.liveUpdatesVerified, false);
  assert.equal(JSON.stringify(result).includes('2.45'), false);
  assert.equal(result.status, 'HTML_METADATA_ONLY_NO_DATA_VALIDATION');
});
test('no redirect traversal or access restriction bypass', async () => {
  const calls = [];
  const result = await inspectPublicPage({ fetchImpl: async (url) => {
    calls.push(url);
    return new Response('', { status: 302, headers: { location: 'https://elsewhere.example/' } });
  }});
  assert.deepEqual(calls, ['https://1win.ng/robots.txt']);
  assert.equal(result.status, 'STOP_ROBOTS_NOT_ACCESSIBLE');
});
test('different public domains route correctly without fetching unapproved hosts', async () => {
  const calls = [];
  const result = await inspectPublicPage({ origin: 'https://1win.com', fetchImpl: async (url) => {
    calls.push(url);
    return url.endsWith('/robots.txt')
      ? new Response('', { status: 404 })
      : new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
  }});
  assert.deepEqual(calls, ['https://1win.com/robots.txt', 'https://1win.com/betting/live']);
  assert.equal(result.source, '1win.com');
  await assert.rejects(inspectPublicPage({ origin: 'https://untrusted.example' }), /allowlisted/);
});
test('robots uses the longest rule, including wildcard and end-anchor', () => {
  assert.equal(robotsDecision('User-agent: *\nDisallow: /betting/*\nAllow: /betting/live', '/betting/live').allowed, true);
  assert.equal(robotsDecision('User-agent: *\nDisallow: /betting/*', '/betting/live').allowed, false);
  assert.equal(robotsDecision('User-agent: *\nDisallow: /betting$','/betting/live').allowed, true);
  assert.equal(robotsDecision('User-agent: *\nDisallow: /betting/live$', '/betting/live').allowed, false);
  assert.equal(robotsDecision('User-agent: *\nDisallow: /\nUser-agent: BetvimaPublicPageFeasibility\nAllow: /betting/live', '/betting/live').allowed, true);
  assert.equal(robotsDecision('User-agent: *\nDisallow: /foo/*\nDisallow: /bar/*', '/betting/live').allowed, true);
});
