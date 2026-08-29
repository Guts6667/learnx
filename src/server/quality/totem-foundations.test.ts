import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readStylesheetSourceGraph } from '@/test-utils/stylesheet-source';

const stylesheet = readStylesheetSourceGraph(
  resolve(process.cwd(), 'src/styles/index.css'),
).source;
const brandContract = readFileSync(
  resolve(process.cwd(), 'docs/V4_TOTEM_DESIGN_IMPLEMENTATION_PLAN.md'),
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
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );

  if (!channels || channels.length !== 3) {
    throw new Error(`Invalid color: ${hex}`);
  }

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);

  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe('Totem visual foundations', () => {
  it('exposes the approved Totem palette alongside the migration aliases', () => {
    const palette = [
      '#101b33',
      '#4f52d9',
      '#eef0fd',
      '#d97757',
      '#f6f7fb',
      '#ffffff',
    ];

    for (const color of palette) {
      expect(stylesheet.toLowerCase()).toContain(color);
      expect(brandContract.toLowerCase()).toContain(color);
    }

    const source = collectSourceFiles(resolve(process.cwd(), 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    // The Totem tokens are the only colour authority. Raw Tailwind palette
    // classes must never bypass them: a `bg-slate-900` card once shipped into
    // the authenticated offline state, unreadable on the light canvas and
    // opted out of the prefers-contrast overrides.
    expect(source).not.toMatch(
      /\b(?:bg|text|border|ring|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/i,
    );
  });

  it('defines each brand colour exactly once', () => {
    // Five hex values were written thirteen times between them, which is how
    // the five token layers drifted apart before V4.2 merged them. A role may
    // reference another role, but a literal must appear once.
    const root = stylesheet.slice(
      stylesheet.indexOf(':root {'),
      stylesheet.indexOf('body {'),
    );
    const counts = new Map<string, number>();
    for (const match of root.matchAll(/:\s*(#[0-9a-f]{6});/g)) {
      counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
    const duplicated = [...counts.entries()].filter(([, count]) => count > 1);
    expect(duplicated).toEqual([]);
  });

  it('loads the approved DM Sans family and Totem component geometry', () => {
    expect(stylesheet).toContain('dm-sans-latin-400-normal.woff2');
    expect(stylesheet).toContain('dm-sans-latin-500-normal.woff2');
    expect(stylesheet).not.toContain('manrope-latin-400-normal.woff2');
    expect(stylesheet).not.toContain('source-serif-4-latin-400-normal.woff2');
    expect(stylesheet).toContain('--font-interface:');
    expect(stylesheet).toContain('--space-1: 0.25rem');
    expect(stylesheet).toContain('--space-12: 3rem');
    expect(stylesheet).toContain('--radius-directional: 0.25rem');
    expect(stylesheet).toContain('--radius-control: 0.4375rem');
    expect(stylesheet).toContain('--radius-group: 0.75rem');
    expect(stylesheet).toContain('--radius-mobile-frame: 1.25rem');
    expect(stylesheet).toContain('.ui-badge {\n  display: inline-flex;');
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
    expect(contrast('#101b33', '#f6f7fb')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#5b6478', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#4f52d9')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#3e41b8', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#8491a8', '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast('#8a5a24', '#f6f7fb')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#9b3e32', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    // Roles carried on the ink band. Four surfaces used to invent their own
    // on-dark values; these are the single set they collapsed into.
    expect(contrast('#e6ecf8', '#101b33')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#a7aec6', '#101b33')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#7478e8', '#101b33')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#f2b4a7', '#101b33')).toBeGreaterThanOrEqual(4.5);
    expect(stylesheet).toMatch(
      /\.ui-action--danger \{[\s\S]*?color: color-mix\([\s\S]*?var\(--color-danger\) 90%[\s\S]*?var\(--color-ivory\) 10%/,
    );
  });
});
