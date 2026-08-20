import { spawnSync } from 'node:child_process';

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
});
