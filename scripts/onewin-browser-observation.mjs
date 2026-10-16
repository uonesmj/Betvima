/**
 * One-shot, observational browser test of the public 1win.com live page.
 *
 * No authentication, interception, endpoint discovery, request replay, evasion,
 * raw HTML storage, match/odds extraction, or transfer to BetVima.
 * It only reports aggregate counts and whether the public page changes over time.
 * This is NOT legal clearance nor a complete odds-feed validation.
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const URL = 'https://1win.com/betting/live';
const EXECUTABLES = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'];
const diagnostics = async (page) => page.evaluate(() => {
  const visible = document.body?.innerText || '';
  const links = Array.from(document.querySelectorAll('a[href]'));
  return {
    visibleCharacters: visible.length,
    totalLinks: links.length,
    bettingLinks: links.filter((el) => /\/betting\//i.test(el.getAttribute('href') ?? '')).length,
    oddsShapedNumbers: (visible.match(/\b(?:[1-9]\d?|[1-9]\d{2})\.\d{1,3}\b/g) ?? []).length,
    // Only a one-way non-cryptographic fingerprint for determining whether
    // rendered content changed, not for retrieving textual content or prices.
    visibleFingerprint: visible.split('').reduce((acc, c) =>
      Math.imul(acc ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261),
  };
});
export async function runObservation() {
  const report = {
    source: URL,
    experiment: 'ONE_PUBLIC_BROWSER_NAVIGATION_AGGREGATE_ONLY',
    bookmakerDataExtracted: false, bettingIntegrationApproved: false,
    browserAvailable: false, mainHttpStatus: null, navigated: false,
    websocketConnectionCount: 0, failedResourceCount: 0, requestCount: 0,
    firstSnapshot: null, secondSnapshot: null, contentChanged: null,
    fixtureIdentityVerified: false, marketIdentityVerified: false,
    oddsUpdateLatencyVerified: false, goalsCardsMinutesVerified: false,
    rightsToRepublishVerified: false,
  };
  const executablePath = EXECUTABLES.find((p) => existsSync(p));
  if (!executablePath) return { ...report, status: 'NO_SYSTEM_CHROMIUM' };
  report.browserAvailable = true;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath, timeout: 20_000 });
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    page.on('websocket', () => { report.websocketConnectionCount += 1; });
    page.on('request', () => { report.requestCount += 1; });
    page.on('requestfailed', () => { report.failedResourceCount += 1; });
    const response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    report.mainHttpStatus = response?.status() ?? null;
    report.navigated = true;
    await page.waitForTimeout(5000);
    report.firstSnapshot = await diagnostics(page);
    await page.waitForTimeout(6000);
    report.secondSnapshot = await diagnostics(page);
    report.contentChanged = report.firstSnapshot.visibleFingerprint !== report.secondSnapshot.visibleFingerprint;
    // Avoid exposing any DOM text or even the fingerprints in public CI logs.
    delete report.firstSnapshot.visibleFingerprint;
    delete report.secondSnapshot.visibleFingerprint;
    report.status = 'BROWSER_OBSERVATION_COMPLETE_NOT_FEED_PARITY_TEST';
    await context.close();
  } catch (error) {
    report.status = 'BROWSER_OBSERVATION_FAILED';
    report.errorName = error instanceof Error ? error.name : 'UnknownError';
    // Error messages may include remote URLs or request information; omit them.
  } finally {
    await browser?.close().catch(() => {});
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runObservation();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
