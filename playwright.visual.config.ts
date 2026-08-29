import { defineConfig, devices } from '@playwright/test';

/**
 * Visual baselines for design work.
 *
 * Screenshots are platform-specific, and baselines here are generated on the
 * maintainer's machine, so this suite is a local pre-flight rather than a CI
 * gate: run it before and after a token, type or palette change and read the
 * diff. Enforcing it in CI additionally requires Linux baselines, produced by
 * running `--update-snapshots` on a Linux runner and committing the result.
 */
export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'html',
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      // `threshold` absorbs anti-aliasing noise per pixel; the ratio must stay
      // tight or a palette change hides in it — accent-coloured pixels are a
      // small fraction of a full-page capture.
      threshold: 0.01,
      maxDiffPixelRatio: 0.0005,
      scale: 'css',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    locale: 'fr-FR',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    {
      name: 'mobile-390',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { height: 844, width: 390 },
      },
    },
    {
      name: 'tablet-768',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { height: 1024, width: 768 },
      },
    },
    {
      name: 'desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { height: 1000, width: 1440 },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
});
