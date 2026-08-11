import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve('prisma/migrations/20260812130000_add_credit_ledger/migration.sql'),
  'utf8',
);
const service = readFileSync(
  resolve('src/server/credits/prisma-credit-ledger.ts'),
  'utf8',
);

describe('V4-006 credit ledger schema', () => {
  it('stores integer balances with separate free and purchased provenance', () => {
    expect(schema).toContain('enum CreditProvenance');
    expect(schema).toContain('FREE_ALLOCATION @map("free_allocation")');
    expect(schema).toContain('PURCHASED       @map("purchased")');
    expect(schema).toMatch(/freeBalance\s+BigInt/);
    expect(schema).toMatch(/purchasedBalance\s+BigInt/);
    expect(migration).toContain('"free_balance" BIGINT');
    expect(migration).toContain('"purchased_balance" BIGINT');
    expect(migration).not.toMatch(/DOUBLE PRECISION|REAL/);
  });

  it('enforces non-negative projections, valid lots and reservation ceilings', () => {
    expect(migration).toContain('credit_accounts_non_negative_check');
    expect(migration).toContain('credit_lots_amount_check');
    expect(migration).toContain('credit_lots_expiry_check');
    expect(migration).toContain('credit_reservations_amount_check');
    expect(migration).toContain('"settled_amount" <= "ceiling_amount"');
  });

  it('binds reservation and ledger ownership to the same account and user', () => {
    expect(migration).toContain('credit_accounts_id_user_id_key');
    expect(migration).toContain(
      'FOREIGN KEY ("account_id", "user_id") REFERENCES "credit_accounts"("id", "user_id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("reservation_id", "account_id") REFERENCES "credit_reservations"("id", "account_id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("lot_id", "account_id") REFERENCES "credit_lots"("id", "account_id")',
    );
  });

  it('makes ledger entries append-only at the database boundary', () => {
    expect(migration).toContain('prevent_credit_ledger_mutation');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "credit_ledger_entries"');
    expect(migration).toContain('credit ledger entries are append-only');
  });

  it('requires audited compensating admin entries', () => {
    expect(schema).toContain('CREDIT_ADMIN_ADJUSTMENT');
    expect(migration).toContain('credit_ledger_entries_admin_audit_check');
    expect(migration).toContain(
      '"type" = \'admin_adjustment\' AND "actor_user_id" IS NOT NULL',
    );
    expect(migration).toContain('LENGTH(BTRIM("reason")) > 0');
  });

  it('uses unique operation and reservation idempotency identities', () => {
    expect(migration).toContain(
      'credit_reservations_account_id_idempotency_key_key',
    );
    expect(migration).toContain(
      'credit_ledger_entries_account_id_operation_key_operation_sequence_key',
    );
    expect(migration).toContain('request_fingerprint');
  });

  it('serializes account mutations and retries transaction conflicts', () => {
    expect(service).toContain('Prisma.TransactionIsolationLevel.Serializable');
    expect(service).toContain('FOR UPDATE');
    expect(service).toContain('isRetryableCreditTransactionError');
    expect(service).toContain("candidate.code === 'P2034'");
    expect(service).toContain("candidate.code === 'P2002'");
    expect(service).toContain("candidate.message.includes('40001')");
    expect(service).toContain("meta.code === '40001'");
  });

  it('keeps the ledger as source of truth and treats projections as rebuildable', () => {
    expect(service).toContain('balanceFromLedger');
    expect(service).toContain('reconstructCreditBalance');
    expect(service).toContain('rebuildProjection');
    expect(service).toContain('assertProjection');
  });
});
