import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const viteConfig = readFileSync(
  resolve(process.cwd(), 'vite.config.ts'),
  'utf8',
);
const cacheCleanup = readFileSync(
  resolve(process.cwd(), 'public/sw-cache-cleanup.js'),
  'utf8',
);
const navigationPolicy = readFileSync(
  resolve(process.cwd(), 'src/lib/pwa-navigation.ts'),
  'utf8',
);

describe('public PWA route freshness', () => {
  it('automatically activates a compatible worker and refreshes public shells from the network', () => {
    expect(viteConfig).toContain("registerType: 'autoUpdate'");
    expect(viteConfig).toContain("handler: 'NetworkFirst'");
    expect(viteConfig).toContain("cacheName: 'learnx-public-shell-v1'");

    for (const path of [
      '/login',
      '/request-access',
      '/verify-email',
      '/activate',
      '/interest',
    ]) {
      expect(viteConfig).toContain(`'${path}'`);
    }
  });

  it('keeps APIs outside navigation caching and removes incompatible legacy caches', () => {
    expect(navigationPolicy).toContain('/^\\/api\\//');
    expect(navigationPolicy).toContain(
      '/^\\/(?:login|request-access|verify-email|activate|interest)(?:\\/|$)/',
    );
    expect(navigationPolicy).toContain(
      '/^\\/research\\/ai-correction(?:\\/|$)/',
    );
    expect(cacheCleanup).toContain("'learnx-pedagogy-v1'");
    expect(cacheCleanup).toContain("'learnx-public-shell-v0'");
  });
});
