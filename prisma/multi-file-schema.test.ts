import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readPrismaSchemaSync } from './schema-test-utils.js';

describe('Prisma multi-file schema', () => {
  it('keeps infrastructure in the main schema and declarations in domain files', () => {
    const mainSchema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
    const fullSchema = readPrismaSchemaSync();

    expect(mainSchema).toContain('generator client');
    expect(mainSchema).toContain('datasource db');
    expect(mainSchema).not.toMatch(/^(?:enum|model)\s+/m);
    expect(fullSchema.match(/^enum\s+/gm)).toHaveLength(50);
    expect(fullSchema.match(/^model\s+/gm)).toHaveLength(63);
  });

  it('uses the supported schema directory without relocating migration history', () => {
    const config = readFileSync(resolve('prisma.config.ts'), 'utf8');
    const migrationDirectories = readdirSync(resolve('prisma/migrations'), {
      withFileTypes: true,
    }).filter((entry) => entry.isDirectory());

    expect(config).toContain("schema: 'prisma'");
    expect(config).toContain("path: 'prisma/migrations'");
    expect(migrationDirectories).toHaveLength(42);
  });
});
