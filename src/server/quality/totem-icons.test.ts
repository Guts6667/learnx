import { readFile } from 'node:fs/promises';

const geometry = {
  l: 'M132 112h64v224h140v64H132z',
  viewBox: '0 0 512 512',
  x: 'm264 176 44 62 44-62h76l-82 108 88 116h-78l-48-68-48 68h-78l88-116-82-108z',
} as const;

const paperIcons = [
  ['public/apple-touch-icon.png', 180],
  ['public/pwa-192x192.png', 192],
  ['public/pwa-512x512.png', 512],
  ['public/pwa-maskable-512x512.png', 512],
] as const;

function pngDimensions(buffer: Buffer) {
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

describe('approved LearnX brand assets', () => {
  it('preserves the canonical geometry and exact color roles', async () => {
    const main = await readFile('public/learnx-icon.svg', 'utf8');
    const mark = await readFile('public/learnx-mark-on-paper.svg', 'utf8');

    for (const svg of [main, mark]) {
      expect(svg).toContain(`viewBox="${geometry.viewBox}"`);
      expect(svg).toContain(`d="${geometry.l}"`);
      expect(svg).toContain(`d="${geometry.x}"`);
    }
    expect(new Set(main.match(/#[0-9A-F]{6}/g))).toEqual(
      new Set(['#121C24', '#F8F5EE', '#557F9A']),
    );
    expect(new Set(mark.match(/#[0-9A-F]{6}/g))).toEqual(
      new Set(['#121C24', '#557F9A']),
    );
  });

  it.each(paperIcons)('exports %s at %d px', async (path, size) => {
    const buffer = await readFile(path);
    expect(pngDimensions(buffer)).toEqual({ height: size, width: size });
  });

  it('connects manifests and HTML to the approved brand exports', async () => {
    const html = await readFile('index.html', 'utf8');
    const englishManifest = await readFile(
      'public/manifest-en.webmanifest',
      'utf8',
    );
    const vite = await readFile('vite.config.ts', 'utf8');

    expect(html).toContain('/learnx-icon.svg?v=brand-1');
    expect(html).toContain('/apple-touch-icon.png?v=brand-1');
    for (const source of [englishManifest, vite]) {
      expect(source).toContain('/pwa-192x192.png?v=brand-1');
      expect(source).toContain('/pwa-512x512.png?v=brand-1');
      expect(source).toContain('/pwa-maskable-512x512.png?v=brand-1');
    }
  });
});
