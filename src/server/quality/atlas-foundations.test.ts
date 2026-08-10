import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const stylesheet = readFileSync(
  resolve(process.cwd(), 'src/styles/index.css'),
  'utf8',
);
const brandContract = readFileSync(
  resolve(process.cwd(), 'docs/V3_5_BRAND_DIRECTION.md'),
  'utf8',
);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(?:css|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function luminance(hex: string): number {
  const channels = hex
    .match(/\w\w/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  if (!channels || channels.length !== 3) {
    throw new Error(`Invalid color: ${hex}`);
  }

  return (
    0.2126 * channels[0] +
    0.7152 * channels[1] +
    0.0722 * channels[2]
  );
}

function contrast(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);

  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe('Atlas visual foundations', () => {
  it('exposes the exact A2 palette without the retired green tokens', () => {
    const palette = [
      '#121c24',
      '#1a2933',
      '#243641',
      '#304650',
      '#557f9a',
      '#89acbe',
      '#d9e4e8',
      '#bea169',
      '#f1eee6',
      '#e2ddd3',
      '#f8f5ee',
      '#b8c4c9',
      '#c4766c',
    ];

    for (const color of palette) {
      expect(stylesheet.toLowerCase()).toContain(color);
    }

    for (const retiredColor of [
      '#111a1b',
      '#1a2626',
      '#80b5a8',
      '#9bc9bd',
      '#365f56',
    ]) {
      expect(stylesheet.toLowerCase()).not.toContain(retiredColor);
      expect(brandContract.toLowerCase()).not.toContain(retiredColor);
    }

    const source = collectSourceFiles(resolve(process.cwd(), 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /(?:text|bg|border)-(?:cyan|emerald|green|teal)-/i,
    );
  });

  it('loads both Atlas typefaces locally and exposes the exact geometry scale', () => {
    expect(stylesheet).toContain('manrope-latin-400-normal.woff2');
    expect(stylesheet).toContain('manrope-latin-500-normal.woff2');
    expect(stylesheet).toContain('source-serif-4-latin-400-normal.woff2');
    expect(stylesheet).toContain('source-serif-4-latin-500-normal.woff2');
    expect(stylesheet).toContain('--space-1: 0.25rem');
    expect(stylesheet).toContain('--space-12: 3rem');
    expect(stylesheet).toContain('--radius-directional: 0.25rem');
    expect(stylesheet).toContain('--radius-control: 0.4375rem');
    expect(stylesheet).toContain('--radius-group: 0.75rem');
    expect(stylesheet).toContain('--radius-mobile-frame: 1.25rem');
    expect(stylesheet).toContain(
      '.ui-badge {\n  display: inline-flex;',
    );
    expect(stylesheet).toMatch(
      /\.ui-badge \{[\s\S]*?border-radius: var\(--radius-directional\)/,
    );
    expect(stylesheet).toMatch(
      /\.ui-progress__track \{[\s\S]*?border-radius: var\(--radius-directional\)/,
    );
    expect(stylesheet).toMatch(
      /\.ui-drawer-panel \{[\s\S]*?border-radius: var\(--radius-overlay\)/,
    );
  });

  it('keeps text and interactive boundaries above their WCAG thresholds', () => {
    expect(contrast('#f8f5ee', '#121c24')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#b8c4c9', '#121c24')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#f8f5ee', '#4c748c')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#89acbe', '#121c24')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#466b82', '#f1eee6')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#60747e', '#121c24')).toBeGreaterThanOrEqual(3);
    expect(stylesheet).toMatch(
      /\.ui-action--danger \{[\s\S]*?color: color-mix\([\s\S]*?var\(--color-danger\) 90%[\s\S]*?var\(--color-ivory\) 10%/,
    );
  });
});
