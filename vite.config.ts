import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import { pwaNavigateFallbackDenylist } from './src/lib/pwa-navigation.ts';

interface CoverageThresholds {
  branches: number;
  functions: number;
  lines: number;
  statements: number;
}

interface QualityBaseline {
  coverage: {
    baselineThresholdsPercent: CoverageThresholds;
    finalThresholdsPercent: CoverageThresholds;
  };
}

const qualityBaseline = JSON.parse(
  readFileSync(
    new URL('./quality/v4-1-baseline.json', import.meta.url),
    'utf8',
  ),
) as QualityBaseline;
const qualityMode = process.env.LEARNX_V4_1_QUALITY_MODE ?? 'baseline';

if (qualityMode !== 'baseline' && qualityMode !== 'final') {
  throw new Error(
    `Unsupported LEARNX_V4_1_QUALITY_MODE: ${qualityMode}. Expected baseline or final.`,
  );
}

const coverageThresholds =
  qualityMode === 'final'
    ? qualityBaseline.coverage.finalThresholdsPercent
    : qualityBaseline.coverage.baselineThresholdsPercent;

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    VitePWA({
      injectRegister: null,
      manifest: {
        background_color: '#f4f6fb',
        categories: ['education', 'productivity'],
        description:
          'Votre environnement personnel pour apprendre, pratiquer et réviser.',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png?v=brand-1',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png?v=brand-1',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            sizes: '512x512',
            src: '/pwa-maskable-512x512.png?v=brand-1',
            type: 'image/png',
          },
        ],
        lang: 'fr',
        name: 'LearnX — Parcours personnel',
        orientation: 'portrait-primary',
        scope: '/',
        short_name: 'LearnX',
        start_url: '/today',
        theme_color: '#17233b',
      },
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{css,html,js,png,svg,woff2}'],
        importScripts: ['/sw-cache-cleanup.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: pwaNavigateFallbackDenylist,
        runtimeCaching: [
          {
            handler: 'NetworkFirst',
            options: {
              cacheName: 'learnx-public-shell-v1',
              expiration: {
                maxAgeSeconds: 24 * 60 * 60,
                maxEntries: 5,
              },
              networkTimeoutSeconds: 5,
            },
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' &&
              [
                '/login',
                '/request-access',
                '/verify-email',
                '/activate',
                '/interest',
              ].includes(url.pathname),
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'api/**/*.test.ts',
      'prisma/**/*.test.ts',
      'src/**/*.test.{ts,tsx}',
    ],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      thresholds: coverageThresholds,
    },
  },
});
