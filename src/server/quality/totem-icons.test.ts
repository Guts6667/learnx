import { readFile } from 'node:fs/promises';

const geometry = {
  l: 'M132 112h64v224h140v64H132z',
  viewBox: '0 0 512 512',
  x: 'm264 176 44 62 44-62h76l-82 108 88 116h-78l-48-68-48 68h-78l88-116-82-108z',
} as const;

const sizes = [1024, 512, 192, 180, 60, 40, 32, 29] as const;

function pngDimensions(buffer: Buffer) {
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

describe('Totem application icons', () => {
  it('preserves the canonical geometry and exact color roles', async () => {
    const main = await readFile('public/learnx-icon.svg', 'utf8');
    const dark = await readFile('public/learnx-icon-dark.svg', 'utf8');

    for (const svg of [main, dark]) {
      expect(svg).toContain(`viewBox="${geometry.viewBox}"`);
      expect(svg).toContain(`d="${geometry.l}"`);
      expect(svg).toContain(`d="${geometry.x}"`);
    }
    expect(new Set(main.match(/#[0-9A-F]{6}/g))).toEqual(
      new Set(['#FFFAF0', '#17233B', '#3558C9']),
    );
    expect(new Set(dark.match(/#[0-9A-F]{6}/g))).toEqual(
      new Set(['#17233B', '#FFFAF0', '#89A7FF']),
    );
  });

  it.each(sizes)('exports the paper icon at %d px', async (size) => {
    const buffer = await readFile(`public/learnx-icon-${size}.png`);
    expect(pngDimensions(buffer)).toEqual({ height: size, width: size });
  });

  it('connects manifests and HTML to documented Totem exports', async () => {
    const html = await readFile('index.html', 'utf8');
    const englishManifest = await readFile(
      'public/manifest-en.webmanifest',
      'utf8',
    );
    const vite = await readFile('vite.config.ts', 'utf8');

    expect(html).toContain('/learnx-icon-dark.svg?v=totem-1');
    expect(html).toContain('/learnx-icon-180.png?v=totem-1');
    for (const source of [englishManifest, vite]) {
      expect(source).toContain('/learnx-icon-192.png?v=totem-1');
      expect(source).toContain('/learnx-icon-512.png?v=totem-1');
      expect(source).not.toContain('pwa-maskable-512x512.png');
    }
  });
});
