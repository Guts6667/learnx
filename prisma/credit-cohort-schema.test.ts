import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readPrismaSchemaSync } from './schema-test-utils.js';

const schema = readPrismaSchemaSync();
const migration = readFileSync(
  resolve('prisma/migrations/20260829220000_add_credit_cohorts/migration.sql'),
  'utf8',
);

describe('cohortes de crédits (V4.5-163)', () => {
  it('interdit deux octrois pour un même cycle par contrainte, pas par code', () => {
    // This is where the guarantee lives. The service checks first as a fast
    // path, but the database is what refuses a second record — a
    // check-then-insert cannot promise that under concurrency.
    const cycle = schema.slice(
      schema.indexOf('model CreditGrantCycle'),
      schema.indexOf('@@map("credit_grant_cycles")'),
    );
    expect(cycle).toContain('@@unique([userId, policyVersionId, cycleKey])');
    expect(cycle).toContain('@@unique([userId, idempotencyKey])');
  });

  it('exige la cohorte sur chaque octroi', () => {
    // Nullable would let a grant exist without saying which cohort it was made
    // under, which is exactly the history a later cohort edit must not rewrite.
    const cycle = schema.slice(
      schema.indexOf('model CreditGrantCycle'),
      schema.indexOf('@@map("credit_grant_cycles")'),
    );
    expect(cycle).toMatch(/\n {2}cohort {10}CreditCohort\n/);
  });

  it('retire le défaut posé pour rendre la colonne non nulle', () => {
    // The default exists only so the column can be added to an empty table.
    // Left in place it would become a value a future insert could rely on
    // without stating it.
    expect(migration).toContain(
      'ALTER TABLE "credit_grant_cycles" ALTER COLUMN "cohort" DROP DEFAULT;',
    );
  });

  it('affecte les comptes existants à la cohorte des premiers inscrits', () => {
    // Everyone on the platform today was admitted by review or invitation.
    expect(migration).toContain(
      `ADD COLUMN IF NOT EXISTS "cohort" "credit_cohort" NOT NULL DEFAULT 'early_adopter'`,
    );
  });

  it('qualifie sa garde de catalogue par le schéma courant', () => {
    expect(migration).toContain('n.nspname = current_schema()');
  });
});
