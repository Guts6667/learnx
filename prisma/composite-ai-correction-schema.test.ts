import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readPrismaSchemaSync } from './schema-test-utils.js';

const schema = readPrismaSchemaSync();
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260812210000_align_composite_ai_corrections/migration.sql',
  ),
  'utf8',
);

describe('composite AI correction schema', () => {
  it('preserves the legacy workflow while adding an explicit composite identity', () => {
    expect(schema).toContain('SINGLE_MODEL @map("single_model")');
    expect(schema).toContain('model AiCorrectionPipelineVersion');
    expect(schema).toContain('pipelineIdentitySnapshot');
    expect(migration).toContain('"pipeline_kind" = \'single_model\'');
    expect(migration).toContain('"pipeline_kind" = \'composite\'');
  });

  it('persists independent role executions and every technical attempt', () => {
    expect(schema).toContain('model AiCorrectionRoleExecution');
    expect(schema).toContain('TARGETED_VERIFIER @map("targeted_verifier")');
    expect(schema).toContain('rawOutput');
    expect(schema).toContain('reasoningTokens');
    expect(migration).toContain(
      'ai_correction_attempts_role_execution_id_attempt_number_key',
    );
  });

  it('supports uncertain and released results without a legacy decision or score', () => {
    expect(migration).toContain('"status" = \'uncertain\'');
    expect(migration).toContain('"indicative_score" IS NULL');
    expect(migration).toContain(
      "\"status\" IN ('unusable_released', 'failed_released')",
    );
  });

  it('keeps composite pricing inactive and snapshots the complete workflow', () => {
    expect(schema).toContain('includesTargetedVerification');
    expect(schema).toContain('costDimensionsSnapshot');
    expect(migration).toContain("\"status\" IN ('draft', 'inactive')");
    expect(migration).toContain('ai_pricing_quote_composite_identity_check');
  });

  it('protects activated pipeline versions from silent mutation', () => {
    expect(migration).toContain('protect_ai_correction_pipeline_version');
    expect(migration).toContain(
      'An activated correction pipeline is immutable',
    );
  });
});
