import { expect, type Page } from '@playwright/test';

/** Viewports the product must support without any horizontal overflow (spec §responsive). */
export const RESPONSIVE_VIEWPORTS = [360, 375, 390, 414, 768, 1024, 1280, 1440, 1920] as const;

/** Fails if the page scrolls horizontally by more than a pixel of rounding slack. */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    const offenders: string[] = [];
    if (documentWidth > viewportWidth + 1) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && (rect.right > viewportWidth + 1 || rect.left < -1)) {
          offenders.push(`${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(' ')[0]}` : ''} (right=${Math.round(rect.right)})`);
          if (offenders.length >= 5) break;
        }
      }
    }
    return { documentWidth, viewportWidth, offenders };
  });
  expect(
    overflow.documentWidth,
    `${label}: document width ${overflow.documentWidth}px exceeds viewport ${overflow.viewportWidth}px. Offenders: ${overflow.offenders.join(', ')}`,
  ).toBeLessThanOrEqual(overflow.viewportWidth + 1);
}

/** Other-content guard: the rest of the page must not change size when the bet slip opens. */
export async function documentWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

/**
 * Finds a match page to exercise. Returns null when the catalogue has no matches (which is the
 * honest state when no sports provider is configured); callers must skip instead of inventing one.
 */
export async function findMatchPath(page: Page): Promise<string | null> {
  for (const path of ['/', '/live', '/sports/football']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href^="/match/"]').first();
    if (await link.count()) {
      const href = await link.getAttribute('href');
      if (href) return href;
    }
  }
  return null;
}
