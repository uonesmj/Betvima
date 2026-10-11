import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The suite runs against a real server (production build) and a real database - it never
 * mocks the API. Start the app with `npm run build && npm run start`, or let Playwright do it
 * with `webServer` (set E2E_START_SERVER=1).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    viewport: { width: 390, height: 844 },
    launchOptions: { executablePath: '/usr/lib64/chromium-browser/chromium-browser' },
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'], locale: 'fa-IR', timezoneId: 'Asia/Tehran' } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], locale: 'fa-IR', timezoneId: 'Asia/Tehran' } },
    // Cross-engine coverage: the same contract specs run on Firefox and WebKit so a
    // Chromium-only CSS/JS assumption cannot ship unnoticed.
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], locale: 'fa-IR', timezoneId: 'Asia/Tehran' } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], locale: 'fa-IR', timezoneId: 'Asia/Tehran' } },
    // Optional: chrome/msedge are only used when explicitly requested
    //   npx playwright test --project=windows-chrome
    { name: 'windows-chrome', use: { ...devices['Desktop Chrome'], channel: undefined, locale: 'fa-IR', timezoneId: 'Asia/Tehran' }, testIgnore: /.*/ },
  ],
  webServer: process.env.E2E_START_SERVER
    ? {
        command: 'npm run start',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
