import { fileURLToPath, URL } from 'node:url';

import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact(), tailwindcss()],
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
