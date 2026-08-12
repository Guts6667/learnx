import {
  CreditLedgerEntryType,
  CreditProvenance,
} from '../../../generated/prisma/client.js';
import { describe, expect, it } from 'vitest';

import { deriveCreditProjection } from './credit-administration.js';

describe('V4-008 credit projections', () => {
  it('reconciles available, reserved, consumed and expired values from the ledger', () => {
    const projection = deriveCreditProjection([
      { amount: 100n, provenance: CreditProvenance.FREE_ALLOCATION, type: CreditLedgerEntryType.GRANT },
      { amount: -30n, provenance: CreditProvenance.FREE_ALLOCATION, type: CreditLedgerEntryType.RESERVATION_HOLD },
      { amount: 30n, provenance: CreditProvenance.FREE_ALLOCATION, type: CreditLedgerEntryType.RESERVATION_RELEASE },
      { amount: -20n, provenance: CreditProvenance.FREE_ALLOCATION, type: CreditLedgerEntryType.SETTLEMENT },
      { amount: -10n, provenance: CreditProvenance.FREE_ALLOCATION, type: CreditLedgerEntryType.EXPIRATION },
      { amount: 50n, provenance: CreditProvenance.PURCHASED, type: CreditLedgerEntryType.GRANT },
      { amount: -5n, provenance: CreditProvenance.PURCHASED, type: CreditLedgerEntryType.RESERVATION_HOLD },
    ]);

    expect(projection).toEqual({
      free: { available: 70n, consumed: 20n, expired: 10n, reserved: 0n },
      purchased: { available: 45n, consumed: 0n, expired: 0n, reserved: 5n },
      totalAvailable: 115n,
      totalReserved: 5n,
    });
  });

  it('rejects an inconsistent negative projection', () => {
    expect(() =>
      deriveCreditProjection([
        { amount: -1n, provenance: CreditProvenance.PURCHASED, type: CreditLedgerEntryType.SETTLEMENT },
      ]),
    ).toThrow('CREDIT_LEDGER_INCONSISTENT');
  });
});
