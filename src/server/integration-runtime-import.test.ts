import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('integration runtime module resolution', () => {
  it('loads the API entrypoint through the same tsx loader used by integration CI', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--eval',
        "import('./api/index.ts')",
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: process.env,
      },
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('keeps Vercel server runtime imports resolvable by Node', () => {
    const roots = ['api', 'src/lib', 'src/server'];
    const unresolvedImports: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(filename);
        } else if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.test.ts')
        ) {
          const source = readFileSync(filename, 'utf8');
          if (
            /from ['"]@\//u.test(source) ||
            /import\(['"]@\//u.test(source) ||
            /(?:from\s+|import\()['"][^'"]+\.ts['"]/u.test(source)
          ) {
            unresolvedImports.push(filename);
          }
        }
      }
    };

    roots.forEach(visit);
    expect(unresolvedImports).toEqual([]);
  });
});
