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
        background_color: '#020617',
        categories: ['education', 'productivity'],
        description:
          'Votre environnement personnel pour apprendre, pratiquer et réviser.',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        lang: 'fr',
        name: 'LearnX — Parcours personnel',
        orientation: 'portrait-primary',
        scope: '/',
        short_name: 'LearnX',
        start_url: '/',
        theme_color: '#020617',
      },
      registerType: 'prompt',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{css,html,js,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'learnx-pedagogy-v1',
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 30,
                maxEntries: 30,
              },
              networkTimeoutSeconds: 4,
            },
            urlPattern: /\/api\/lessons\/[^/?]+(?:\?preview=true)?$/,
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
