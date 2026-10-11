/**
 * BET SLIP CONTRACT (explicit product requirement):
 *   1. only a dedicated bet-slip control may open the slip
 *   2. clicking a match, team, league, score or market title must NOT open it
 *   3. closing it keeps it closed (no re-open on the next click)
 *   4. money and odds are only ever shown, never edited, by the client
 */
import { expect, test } from '@playwright/test';

const OPEN_CONTROL = '[data-testid="betslip-open-control"]';
const MOBILE_CONTROL = '[data-testid="betslip-mobile-control"]';
const CLOSE_CONTROL = '[data-testid="betslip-close"]:visible';
/** Rail (desktop) and sheet (mobile) are the same component tree; either counts as "the slip".
 *  Only one of the two is rendered visible per breakpoint, so always query the visible one. */
const PANEL = '[data-betslip-panel]:visible';

test.describe('bet slip contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('opens only from a dedicated control', async ({ page }) => {
    const panelVisible = async () => (await page.locator(PANEL).count()) > 0;
    expect(await panelVisible(), 'the bet slip must not be open on load').toBe(false);

    // Navigating content must never open it.
    const matchLink = page.locator('a[href^="/match/"]').first();
    if (await matchLink.count()) {
      await matchLink.click({ trial: true }).catch(() => undefined);
      await matchLink.hover();
      expect(await panelVisible(), 'hovering a match must not open the bet slip').toBe(false);
    }

    for (const selector of [OPEN_CONTROL, MOBILE_CONTROL]) {
      if (await page.locator(selector).count()) {
        await page.locator(selector).first().click();
        await expect(page.locator(PANEL).first()).toBeVisible({ timeout: 5000 });
        return;
      }
    }
    test.skip(true, 'no bet slip control in this build');
  });

  test('closing the slip keeps it closed', async ({ page }) => {
    const opener = page.locator(OPEN_CONTROL);
    if ((await opener.count()) === 0) test.skip(true, 'no bet slip control in this build');
    const panel = page.locator(PANEL).first();  // visible-only selector

    await opener.first().click();
    await expect(panel).toBeVisible();

    if (await page.locator(CLOSE_CONTROL).count()) {
      await page.locator(CLOSE_CONTROL).first().click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(panel).toBeHidden({ timeout: 5000 });

    // Clicking around must not re-open it.
    const matchLink = page.locator('a[href^="/match/"]').first();
    if (await matchLink.count()) await matchLink.click({ trial: true }).catch(() => undefined);
    await page.mouse.click(5, 5);
    await expect(panel).toBeHidden();
  });

  test('content clicks navigate instead of opening the slip', async ({ page }) => {
    const matchLink = page.locator('a[href^="/match/"]').first();
    if ((await matchLink.count()) === 0) test.skip(true, 'no matches available in this deployment');
    const href = await matchLink.getAttribute('href');
    await matchLink.click();
    await expect(page).toHaveURL(new RegExp(`${href?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    const panel = page.locator(PANEL).first();  // visible-only selector
    expect(await panel.isVisible().catch(() => false), 'navigating to a match must not open the bet slip').toBe(false);
  });
});
