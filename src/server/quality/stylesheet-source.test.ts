import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import { readStylesheetSourceGraph } from './stylesheet-source';

const entryPath = resolve(process.cwd(), 'src/styles/index.css');

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('stylesheet source graph', () => {
  it('resolves every local stylesheet once in the declared cascade order', () => {
    const graph = readStylesheetSourceGraph(entryPath);

    expect(graph.files).toEqual([
      'src/styles/index.css',
      'src/styles/tokens/fonts.css',
      'src/styles/tokens/theme.css',
      'src/styles/surfaces/public.css',
      'src/styles/base.css',
      'src/styles/primitives/layout.css',
      'src/styles/primitives/components.css',
      'src/styles/surfaces/shells.css',
      'src/styles/surfaces/admin.css',
      'src/styles/surfaces/product.css',
      'src/styles/primitives/overlays-content.css',
      'src/styles/accessibility.css',
      'src/styles/surfaces/correction-assessment-reviews.css',
    ]);
    expect(graph.packageImports).toEqual(['tailwindcss']);
    expect(graph.source).not.toMatch(/@import\s+['"]\.\//u);
    expect(graph.source.match(/@import\s+['"]tailwindcss['"]/gu)).toHaveLength(1);
  });

  it('keeps index.css as the only TypeScript stylesheet entry point', () => {
    const imports = collectTypeScriptFiles(resolve(process.cwd(), 'src')).flatMap(
      (path) => {
        const source = readFileSync(path, 'utf8');
        const matches = source.matchAll(/import\s+['"]([^'"]+\.css)['"]/gu);
        return [...matches].map((match) => ({
          file: relative(process.cwd(), path).split(sep).join('/'),
          specifier: match[1],
        }));
      },
    );

    expect(imports).toEqual([
      {
        file: 'src/main.tsx',
        specifier: '@/styles/index.css',
      },
    ]);
  });
});
