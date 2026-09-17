import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Integration database path selection', () => {
  const workflow = readFileSync('.github/workflows/integration.yml', 'utf8');
  const source = /relevant='([^']+)'/u.exec(workflow)?.[1];
  if (!source) throw new Error('Integration scope pattern missing');
  const relevant = new RegExp(source, 'u');
  it.each([
    'prisma/schema.prisma',
    'prisma.config.ts',
    'src/server/database-url.ts',
    'api/index.ts',
    'scripts/run-integration-tests.ts',
    'quality/protected-db-hosts.json',
    'package.json',
    'pnpm-lock.yaml',
    'vercel.json',
    '.github/workflows/integration.yml',
  ])('runs database validation for %s', (file) => {
    expect(relevant.test(file)).toBe(true);
  });
  it.each([
    'docs/a.md',
    'README.md',
    'benchmarks/a.json',
    'src/components/a.tsx',
    '.github/workflows/quality.yml',
    'package-lock.json',
    'other/package.json',
  ])('does not acquire a database for %s', (file) => {
    expect(relevant.test(file)).toBe(false);
  });
});
