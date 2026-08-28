import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The design catalog is intentionally development-only and absent from dist.
  testIgnore: ['**/ui-primitives.spec.ts'],
  // A single production origin is shared by all projects. Serial execution
  // prevents auth/request fixtures from racing across browser engines.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-production' }],
  ],
  outputDir: 'test-results-production',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'fr-FR',
    // PWA lifecycle has dedicated deterministic tests. Blocking it here keeps
    // request mocks isolated while exercising the exact production bundle.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'], viewport: { height: 844, width: 390 } },
    },
    {
      name: 'tablet-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { height: 1024, width: 768 },
      },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command:
      'pnpm build && pnpm preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
