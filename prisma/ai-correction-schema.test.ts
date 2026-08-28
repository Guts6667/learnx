import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readPrismaSchemaSync } from './schema-test-utils.js';

const schema = readPrismaSchemaSync();
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260812090000_add_persistent_ai_corrections/migration.sql',
  ),
  'utf8',
);
const formativeResultMigration = readFileSync(
  resolve(
    'prisma/migrations/20260825192500_allow_formative_single_model_results/migration.sql',
  ),
  'utf8',
);

describe('persistent AI correction schema', () => {
  it('stores immutable snapshots, server decisions and attempt history', () => {
    expect(schema).toContain('model AiCorrection {');
    expect(schema).toContain('submissionSnapshot');
    expect(schema).toContain('contractSnapshot');
    expect(schema).toContain('promptSnapshot');
    expect(schema).toContain('structuredResult');
    expect(schema).toContain('model AiCorrectionAttempt {');
    expect(schema).toContain('@@unique([correctionId, sequence])');
  });

  it('binds idempotency to the user and prevents cross-owner targets', () => {
    expect(schema).toContain('@@unique([userId, idempotencyKey])');
    expect(schema).toContain(
      '@relation(fields: [exerciseSubmissionId, userId], references: [id, userId]',
    );
    expect(schema).toContain(
      '@relation(fields: [stageAssessmentSubmissionId, userId], references: [id, userId]',
    );
    expect(migration).toContain('ai_corrections_exactly_one_submission_check');
    expect(migration).toContain(
      'FOREIGN KEY ("exercise_submission_id", "user_id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("stage_assessment_submission_id", "user_id")',
    );
  });

  it('keeps scientific validation outside correction authority', () => {
    const correctionMethod = schema.slice(
      schema.indexOf('enum AiCorrectionMethod'),
      schema.indexOf('enum AiCorrectionStatus'),
    );
    expect(correctionMethod).toContain('DETERMINISTIC');
    expect(correctionMethod).toContain('AI');
    expect(correctionMethod).not.toContain('SCIENTIFIC');
  });

  it('constrains persisted server scores and confidence', () => {
    expect(migration).toContain('ai_corrections_score_check');
    expect(migration).toContain('ai_corrections_confidence_check');
    expect(migration).toContain('"confidence" >= 0');
    expect(migration).toContain('"confidence" <= 1');
    expect(migration).toContain('ai_corrections_terminal_result_check');
    expect(migration).toContain('ai_correction_attempts_result_check');
  });

  it('allows terminal formative results without reviving PASS/FAIL authority', () => {
    expect(formativeResultMigration).toContain(
      "\"status\" IN ('completed', 'provisional')",
    );
    expect(formativeResultMigration).toContain('"decision" IS NULL');
    expect(formativeResultMigration).toContain('"score" IS NULL');
    expect(formativeResultMigration).toContain('"confidence" IS NULL');
    expect(formativeResultMigration).toContain(
      '"structured_result_json" IS NOT NULL',
    );
  });
});
