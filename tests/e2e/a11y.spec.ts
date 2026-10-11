/**
 * AUTOMATED ACCESSIBILITY CHECKS (axe-core).
 *
 * This is an automated audit, not a substitute for a manual WCAG 2.1 AA review: it catches
 * structural problems (missing names, broken landmarks, contrast, duplicate ids, language and
 * heading order) that are objectively detectable. Anything it flags as `critical` or `serious`
 * fails the suite, so a regression cannot ship silently.
 *
 * Covered pages: home, live, a match page, bet slip (closed and open), wallet/login, help and the
 * anonymous admin gate - in the default Persian RTL locale.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { findMatchPath } from './helpers';

const BLOCKING = ['critical', 'serious'] as const;

async function audit(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

function blockingViolations(results: Awaited<ReturnType<typeof audit>>) {
  return results.violations
    .filter((violation) => BLOCKING.includes(violation.impact as (typeof BLOCKING)[number]))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
    }));
}

const PATHS = ['/', '/live', '/help', '/legal/terms', '/legal/privacy', '/legal/responsible-gaming', '/auth/login', '/admin/dashboard'];

test.describe('accessibility (automated)', () => {
  for (const path of PATHS) {
    test(`no critical/serious violations on ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      const results = await audit(page);
      const blocking = blockingViolations(results);
      expect(blocking, `axe violations on ${path}:\n${JSON.stringify(blocking, null, 2)}`).toEqual([]);
      console.log(`${path}: ${results.violations.length} violation(s) of any impact, ${results.passes.length} checks passed`);
    });
  }

  test('the document declares a language and a direction', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const html = await page.locator('html').evaluate((el) => ({ lang: el.getAttribute('lang'), dir: el.getAttribute('dir') }));
    expect(html.lang).toBeTruthy();
    expect(['rtl', 'ltr']).toContain(html.dir);
  });

  test('a match page and the bet slip stay accessible when opened', async ({ page }) => {
    const matchPath = await findMatchPath(page);
    test.skip(!matchPath, 'no matches available in this deployment');
    await page.goto(matchPath as string, { waitUntil: 'domcontentloaded' });
    expect(blockingViolations(await audit(page))).toEqual([]);

    const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 767px)').matches);
    const control = page.locator(isMobile ? '[data-testid="betslip-mobile-control"]' : '[data-testid="betslip-open-control"]').first();
    if (await control.count()) {
      await control.click();
      await expect(page.locator('[data-betslip-panel]:visible').first()).toBeVisible();
      expect(blockingViolations(await audit(page))).toEqual([]);
    }
  });
});
