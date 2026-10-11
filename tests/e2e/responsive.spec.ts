/**
 * Responsive contract: every listed viewport renders without horizontal overflow, including
 * with the bet slip open. Real server, real pages, no mocks.
 */
import { expect, test } from '@playwright/test';
import { RESPONSIVE_VIEWPORTS, expectNoHorizontalOverflow } from './helpers';

const PUBLIC_PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'homepage' },
  { path: '/live', label: 'live' },
  { path: '/sports/football', label: 'sport page' },
  { path: '/bets', label: 'my bets' },
  { path: '/wallet', label: 'wallet' },
  { path: '/account/profile', label: 'account' },
  { path: '/affiliate/dashboard', label: 'affiliate dashboard' },
  { path: '/admin/dashboard', label: 'admin dashboard' },
  { path: '/help', label: 'help' },
  { path: '/auth/login', label: 'login' },
];

test.describe('responsive layout', () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`no horizontal overflow at ${viewport}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport, height: 900 });
      for (const target of PUBLIC_PAGES) {
        const response = await page.goto(target.path, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${target.path} should render`).toBeLessThan(400);
        await expectNoHorizontalOverflow(page, `${target.label} @${viewport}px`);
      }
    });
  }

  test('bet slip open keeps the layout inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const opener = page.locator('[data-testid="betslip-open-control"]');
    if ((await opener.count()) === 0) test.skip(true, 'no bet slip control rendered in this deployment');
    await opener.first().click();
    await expect(page.locator('[data-betslip-panel]:visible').first()).toBeVisible({ timeout: 5000 });
    for (const width of [360, 390, 768, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalOverflow(page, `bet slip open @${width}px`);
    }
  });
});
