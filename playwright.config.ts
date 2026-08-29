import { defineConfig, devices } from '@playwright/test';

import { devServerPort } from './playwright.ports.js';

const port = devServerPort(4173, 41000);
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: origin,
    locale: 'fr-FR',
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
    command: `pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: !process.env.CI,
  },
});
