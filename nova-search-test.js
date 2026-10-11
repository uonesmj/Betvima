const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }
  });

  await page.goto('http://127.0.0.1:3000/', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  console.log('PAGE_OK=', page.url() === 'http://127.0.0.1:3000/');
  console.log('SEARCH_ARIA=', await page.locator('button[aria-label="Search"]').count());
  console.log(
    'SEARCH_VISIBLE=',
    await page.locator('button[aria-label="Search"]').first().isVisible().catch(() => false)
  );

  const btn = page.locator('button[aria-label="Search"]').first();

  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(300);
  }

  const input = page.locator('input[aria-label="Search teams or leagues"]').first();

  console.log('INPUT_COUNT=', await input.count());
  console.log(
    'INPUT_VISIBLE=',
    await input.isVisible().catch(() => false)
  );

  if (await input.count()) {
    await input.fill('Manchester');
    await page.waitForTimeout(1500);

    const body = await page.locator('body').innerText();

    console.log(
      'HAS_MANCHESTER=',
      body.includes('Manchester United') ||
      body.includes('Manchester City')
    );

    console.log('SEARCH_RESULTS_START');
    console.log(body.slice(0, 5000));
    console.log('SEARCH_RESULTS_END');
  }

  await browser.close();
})().catch((error) => {
  console.error('TEST_ERROR=', error);
  process.exit(1);
});
