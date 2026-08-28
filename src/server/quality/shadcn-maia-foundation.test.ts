import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { compile } from 'tailwindcss';

import { readStylesheetSourceGraph } from '@/test-utils/stylesheet-source';

interface ShadcnConfiguration {
  aliases: {
    components: string;
    utils: string;
  };
  rsc: boolean;
  style: string;
  tailwind: {
    css: string;
    cssVariables: boolean;
  };
}

const configuration = JSON.parse(
  readFileSync(resolve(process.cwd(), 'components.json'), 'utf8'),
) as ShadcnConfiguration;
const stylesheet = readStylesheetSourceGraph(
  resolve(process.cwd(), 'src/styles/index.css'),
).source;

describe('shadcn Maia foundation', () => {
  it('pins the Radix Maia, Vite and client-component contract', () => {
    expect(configuration).toMatchObject({
      aliases: {
        components: '@/components',
        utils: '@/lib/utils',
      },
      rsc: false,
      style: 'radix-maia',
      tailwind: {
        css: 'src/styles/index.css',
        cssVariables: true,
      },
    });
  });

  it('maps shadcn semantics to the existing LearnX brand tokens', () => {
    const mappings = [
      '--background: var(--color-canvas)',
      '--foreground: var(--color-text)',
      '--primary: var(--color-action)',
      '--primary-foreground: var(--color-on-action)',
      '--muted-foreground: var(--color-text-muted)',
      '--destructive: var(--color-danger)',
      '--ring: var(--color-focus)',
    ];

    for (const mapping of mappings) {
      expect(stylesheet).toContain(mapping);
    }

    expect(stylesheet).toContain("'DM Sans'");
    expect(stylesheet).not.toContain('.dark');
  });

  it('compiles the standard accent and border utilities from the live bridge', async () => {
    const theme = stylesheet.match(/@theme inline\s*\{[\s\S]*?\n\}/)?.[0];
    expect(theme).toBeDefined();

    const compiler = await compile(`${theme}\n@tailwind utilities;`);
    const output = compiler.build(['bg-accent', 'border-border']);

    expect(output).toContain('.bg-accent');
    expect(output).toContain('background-color: var(--accent)');
    expect(output).toContain('.border-border');
    expect(output).toContain('border-color: var(--border)');
  });
});
