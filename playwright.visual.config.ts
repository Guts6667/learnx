import { defineConfig, devices } from '@playwright/test';

import { devServerPort } from './playwright.ports.js';

/**
 * Visual baselines for design work.
 *
 * The committed baselines are generated on Linux by `.github/workflows/visual.yml`
 * and the comparison is a blocking CI job. Screenshots are platform-specific, so
 * **`pnpm test:visual` fails on macOS by design** — it is comparing Linux pixels
 * against a macOS render, not reporting a regression.
 *
 * To see your own diff while working on design, run the workflow on your branch
 * and read the `visual-diff` artifact it uploads on failure. To accept a change,
 * dispatch the workflow with `update=true`, download `visual-baselines`, and
 * commit it over `tests/visual/__screenshots__` — after reviewing why the pixels
 * moved, never as a reflex.
 *
 * One source of truth was chosen over per-platform baselines: two sets would
 * have to be regenerated together on every design change, and the system this
 * suite protects exists because duplicated values drift apart.
 */
const port = devServerPort(4174, 42000);
const origin = `http://127.0.0.1:${port}`;

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
      // A ratio alone scales the tolerance with the page, so the gate is
      // weakest exactly where pages are longest and carry the most content.
      // Measured on the committed baselines: `landing.png` at desktop-1440 is
      // 1440x4146, so 0.0005 tolerated 2985 differing pixels — more than an
      // entire footer link — while the smallest capture tolerated only 164.
      // An eighteen-fold spread in strictness, decided by nothing but height.
      //
      // Playwright takes `Math.min` of the two ceilings, so the absolute floor
      // can only tighten and never loosens what the ratio already forbids: the
      // ratio still governs small captures, and this caps tall ones. Three
      // hundred pixels is below any block of text — a footer link is of the
      // order of two thousand — and far above the per-pixel noise `threshold`
      // already absorbs on a fixed Linux runner.
      maxDiffPixelRatio: 0.0005,
      maxDiffPixels: 300,
      scale: 'css',
    },
  },
  use: {
    baseURL: origin,
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
    command: `pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: !process.env.CI,
  },
});
