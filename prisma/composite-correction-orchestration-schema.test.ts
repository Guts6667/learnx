import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readPrismaSchemaSync } from './schema-test-utils.js';

const schema = readPrismaSchemaSync();
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260813100000_orchestrate_composite_correction_settlement/migration.sql',
  ),
  'utf8',
);

describe('V4-009 composite correction orchestration schema', () => {
  it('links one quote, correction and reservation with database ownership checks', () => {
    expect(schema).toContain('pricingQuoteId');
    expect(schema).toContain('creditReservationId');
    expect(migration).toContain('ai_corrections_pricing_quote_user_fkey');
    expect(migration).toContain('ai_corrections_credit_reservation_user_fkey');
    expect(migration).toContain('ai_corrections_pricing_quote_id_key');
    expect(migration).toContain('ai_corrections_credit_reservation_id_key');
  });

  it('persists an auditable financial summary without replacing the ledger', () => {
    expect(schema).toContain('model AiCorrectionFinancialOperation');
    expect(schema).toContain('allocationSnapshot');
    expect(schema).toContain('absorbedCeilingOverrunCredits');
    expect(migration).toContain('ai_correction_financial_terminal_check');
    expect(migration).toContain(
      '"settled_credits" + "released_credits" = "accepted_ceiling_credits"',
    );
  });

  it('keeps reconciliation and ledger completion distinct from terminal results', () => {
    expect(schema).toContain(
      'RECONCILIATION_REQUIRED @map("reconciliation_required")',
    );
    expect(schema).toMatch(/SETTLEMENT_PENDING\s+@map\("settlement_pending"\)/);
    expect(schema).toMatch(/RELEASE_PENDING\s+@map\("release_pending"\)/);
    expect(migration).toContain('reconciliation_code');
    expect(migration).toContain('alert_required');
  });

  it('protects in-flight reservations and persists provider dispatch identities', () => {
    expect(schema).toContain('executionLeaseExpiresAt');
    expect(schema).toContain('providerIdempotencyKey');
    expect(schema).toContain('dispatchStatus');
    expect(schema).toContain('CALL_INTENT @map("call_intent")');
    expect(migration).toContain('provider_idempotency_key');
    expect(migration).toContain('execution_lease_expires_at');
  });

  it('adds the pre-dispatch call intent state without rewriting historical attempts', () => {
    const callIntentMigration = readFileSync(
      resolve(
        'prisma/migrations/20260813160000_add_provider_call_intent/migration.sql',
      ),
      'utf8',
    );
    expect(callIntentMigration).toContain(
      'ALTER TYPE "ai_provider_dispatch_status" ADD VALUE \'call_intent\'',
    );
    expect(callIntentMigration).not.toMatch(
      /UPDATE\s+"ai_correction_attempts"/,
    );
  });

  it('keeps historical fields nullable and performs no destructive backfill', () => {
    expect(migration).toContain('ADD COLUMN "pricing_quote_id" UUID');
    expect(migration).toContain('ADD COLUMN "credit_reservation_id" UUID');
    expect(migration).not.toMatch(/UPDATE\s+"ai_corrections"/);
    expect(migration).not.toContain('DROP COLUMN');
  });
});
