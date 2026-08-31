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
    // Counted, not approximated: adding a model or an enum is a schema
    // decision and must be a deliberate edit here. +1 each in V4.5-112
    // (AiCorrectionCriterionFeedback, AiCorrectionFeedbackVerdict); +1 model
    // and +2 enums in V4.5-140 (AiCorrectionBreakerEvent and its action and
    // reason). +1 model in V4.5-168 (AiCorrectionResearchSample), which is a
    // schema decision if ever there was one: a table that deliberately has no
    // way back to the person whose text it holds.
    expect(fullSchema.match(/^enum\s+/gm)).toHaveLength(56);
    expect(fullSchema.match(/^model\s+/gm)).toHaveLength(70);
  });

  it('uses the supported schema directory without relocating migration history', () => {
    const config = readFileSync(resolve('prisma.config.ts'), 'utf8');
    const migrationDirectories = readdirSync(resolve('prisma/migrations'), {
      withFileTypes: true,
    }).filter((entry) => entry.isDirectory());

    expect(config).toContain("schema: 'prisma'");
    expect(config).toContain("path: 'prisma/migrations'");
    // +1 each in V4.5-112, V4.5-140, V4.5-142, V4.5-166, V4.5-163, V4.5-117,
    // V4.5-195, V4.5-198, V4.5-197, V4.5-203, V4.5-168 and V4.5-212; all
    // additive. Recounted from the directory, never incremented by hand.
    expect(migrationDirectories).toHaveLength(58);
  });
});
