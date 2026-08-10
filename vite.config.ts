import { fileURLToPath, URL } from 'node:url';

import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    VitePWA({
      injectRegister: null,
      manifest: {
        background_color: '#121c24',
        categories: ['education', 'productivity'],
        description:
          'Votre environnement personnel pour apprendre, pratiquer et réviser.',
        display: 'standalone',
        icons: [
          {
            src: '/learnx-icon-192.png?v=atlas-1',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/learnx-icon-512.png?v=atlas-1',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
        lang: 'fr',
        name: 'LearnX — Parcours personnel',
        orientation: 'portrait-primary',
        scope: '/',
        short_name: 'LearnX',
        start_url: '/today',
        theme_color: '#121c24',
      },
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{css,html,js,png,svg,woff2}'],
        importScripts: ['/sw-cache-cleanup.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/(?:login|request-access|verify-email|activate|interest)(?:\/|$)/,
        ],
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
      reporter: ['text', 'html'],
    },
  },
});
