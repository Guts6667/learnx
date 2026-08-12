import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260812200000_add_credit_allocation_administration/migration.sql',
  ),
  'utf8',
);
const ledger = readFileSync(
  resolve('src/server/credits/prisma-credit-ledger.ts'),
  'utf8',
);

describe('V4-008 credit allocation administration schema', () => {
  it('keeps policy values versioned and inactive by default', () => {
    expect(schema).toContain('model CreditAllocationPolicyVersion');
    expect(schema).toContain('model CreditLimitPolicyVersion');
    expect(migration).toContain("DEFAULT 'draft'");
    expect(migration).not.toMatch(/INSERT INTO "credit_(allocation|limit)_policy_versions"/);
  });

  it('makes lots and reservation allocations immutable', () => {
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "credit_lots"');
    expect(migration).toContain(
      'BEFORE UPDATE OR DELETE ON "credit_reservation_allocations"',
    );
    expect(ledger).not.toContain('creditLot.update');
    expect(ledger).not.toContain('creditAccount.update');
  });

  it('derives balances from ledger entries and protects purchased credits', () => {
    expect(migration).toContain('credit account balances are derived from the ledger');
    expect(ledger).toContain('balanceFromLedger');
    expect(ledger).toContain("throw new CreditLedgerError('PURCHASED_CREDITS_PROTECTED')");
  });

  it('does not impose an expiration on complimentary allocations', () => {
    expect(migration).toContain("\"provenance\" = 'free_allocation' OR");
    expect(migration).toContain(
      "(\"provenance\" = 'purchased' AND \"expires_at\" IS NULL)",
    );
  });

  it('prevents duplicate cycle grants without defining a cadence', () => {
    expect(schema).toContain('model CreditGrantCycle');
    expect(schema).toContain('@@unique([userId, policyVersionId, cycleKey])');
    expect(migration).toContain(
      'credit_grant_cycles_user_id_policy_version_id_cycle_key_key',
    );
    expect(migration).not.toMatch(/monthly|daily|calendar|30 days/i);
  });

  it('binds a cycle to the same user account, lot and policy provenance', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("account_id", "user_id") REFERENCES "credit_accounts"("id", "user_id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("lot_id", "account_id") REFERENCES "credit_lots"("id", "account_id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("allocation_policy_id", "provenance") REFERENCES "credit_allocation_policy_versions"("id", "provenance")',
    );
  });
});
