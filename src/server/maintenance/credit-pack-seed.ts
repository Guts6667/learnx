/**
 * The purchasable pack grid (V4.5-212, `docs/V4_5_PRICING_CALIBRATION.md`).
 *
 * Idempotent and replayable: it upserts by key and can be run again without
 * creating a second grid or resetting anything an owner changed on purpose.
 * A seed that is only safe the first time is a seed nobody dares re-run, and
 * a grid nobody dares re-run drifts from the document that decided it.
 *
 * Written as ports so the decision can be proven without a database. Nothing
 * here opens a connection; the caller supplies one, and it is run through
 * `pnpm db:target`, never from a `.env`.
 */

/** Parity is 100 credits per euro; the two larger tiers pay a bonus. */
export const CREDIT_PACK_GRID = [
  {
    credits: 300n,
    currency: 'EUR',
    key: 'entry',
    label: 'Découverte',
    labelEn: 'Starter',
    position: 1,
    priceMinor: 300n,
  },
  {
    credits: 880n,
    currency: 'EUR',
    key: 'regular',
    label: 'Régulier',
    labelEn: 'Regular',
    position: 2,
    priceMinor: 800n,
  },
  {
    credits: 2000n,
    currency: 'EUR',
    key: 'intensive',
    label: 'Intensif',
    labelEn: 'Intensive',
    position: 3,
    priceMinor: 1600n,
  },
] as const;

/**
 * The tier limited to one purchase per account.
 *
 * At 3 € the provider's fixed fee is a large share of the price, so a learner
 * refunding and rebuying it repeatedly costs more than it earns. That is the
 * whole reason for the limit, and it is why a refund does not restore the
 * right — see `hasFulfilledPack`.
 */
export const ENTRY_TIER_PACK_KEY = 'entry';

/** Superseded by the grid; it was one euro for ten credits, for a smoke test. */
const RETIRED_PACK_KEYS = ['preview-placeholder'] as const;

export type CreditPackSeedPorts = {
  deactivatePack: (key: string) => Promise<number>;
  upsertPack: (input: {
    active: boolean;
    credits: bigint;
    currency: string;
    key: string;
    label: string;
    labelEn: string;
    position: number;
    priceMinor: bigint;
  }) => Promise<void>;
};

export type CreditPackSeedResult = {
  deactivated: string[];
  seeded: string[];
};

export async function seedCreditPacks(
  ports: CreditPackSeedPorts,
): Promise<CreditPackSeedResult> {
  const seeded: string[] = [];
  for (const pack of CREDIT_PACK_GRID) {
    await ports.upsertPack({ ...pack, active: true });
    seeded.push(pack.key);
  }

  // Deactivated, never deleted: orders reference a pack key, and removing the
  // row would leave a paid order pointing at nothing. Inactive already means
  // invisible and unbuyable (V4.5-161), which is the whole of what is wanted.
  const deactivated: string[] = [];
  for (const key of RETIRED_PACK_KEYS) {
    if ((await ports.deactivatePack(key)) > 0) deactivated.push(key);
  }

  return { deactivated, seeded };
}
