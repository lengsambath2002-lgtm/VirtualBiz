import { defineConfig, devices } from '@playwright/test';

/**
 * VirtualBiz end-to-end tests (tests/e2e). Runs against E2E_BASE_URL, or starts the dev
 * server on port 3100 (port 3000 is left free for other projects).
 *
 *   pnpm test:e2e                 headless, all specs
 *   pnpm test:e2e --ui            Playwright UI mode
 *   E2E_BASE_URL=https://… pnpm test:e2e
 */
const PORT = 3100;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'tests/e2e/.report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    // The app always displays Phnom Penh time; run the browser there too so date bugs surface.
    timezoneId: 'Asia/Phnom_Penh',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['iPhone 14'], browserName: 'chromium' }, grep: /@phone/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm dev --port ${PORT}`,
        url: `${BASE_URL}/en`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
