import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const stylesheet = readFileSync(
  resolve(process.cwd(), 'src/styles/index.css'),
  'utf8',
);

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
});
