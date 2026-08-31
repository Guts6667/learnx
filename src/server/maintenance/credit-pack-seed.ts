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

/**
 * Parity is 100 credits per euro; the two larger tiers pay a bonus.
 *
 * The names are the Head of UX/UI's, and they say only size (V4.5-212).
 * "Régulier" and "Intensif" qualified the learner rather than the pack —
 * someone modest buying the large one has no business being told they are
 * intensive. Finance's own names could not be reused: "Parcours" is the domain
 * word for a programme (`navigation.programs`), and "Année" would announce a
 * validity the product does not grant, since purchased credits carry no
 * `expiresAt` and never expire.
 *
 * "Premier pack" does real work: it puts the one-per-account limit in the name,
 * so the rule surprises nobody later.
 */
export const CREDIT_PACK_GRID = [
  {
    credits: 300n,
    currency: 'EUR',
    key: 'entry',
    label: 'Premier pack',
    labelEn: 'First pack',
    position: 1,
    priceMinor: 300n,
  },
  {
    credits: 880n,
    currency: 'EUR',
    key: 'regular',
    label: 'Pack standard',
    labelEn: 'Standard pack',
    position: 2,
    priceMinor: 800n,
  },
  {
    credits: 2000n,
    currency: 'EUR',
    key: 'intensive',
    label: 'Grand pack',
    labelEn: 'Large pack',
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

/**
 * The policy constants the screens need, derived here and served rather than
 * computed client-side (V4.5-212).
 *
 * `credits-surfaces.test.ts` forbids the learner screen any arithmetic on
 * `priceMinor` — a figure about money derived in two places is a figure that
 * disagrees with itself eventually. So the rate, the bonus and the capacity
 * are worked out once, on the server, from the same numbers the grid is made
 * of.
 *
 * The calibration document is already at version 1.1.0. The day a correction
 * stops costing 30 credits, a divisor living in the screen would leave three
 * surfaces announcing "environ 29 corrections" with nothing going red.
 */

/** Credits per euro at parity; the larger tiers pay more (§7). */
const PARITY_CREDITS_PER_EURO = 100n;

/** What a correction is quoted at, and what it reserves (§7). */
export const CORRECTION_QUOTE_CREDITS = 30n;
export const CORRECTION_RESERVATION_CREDITS = 45n;

export interface PackFigures {
  /** Credits beyond parity for this price. Zero at the entry tier. */
  bonusCredits: bigint;
  /** Credits per euro: 100, 110, 125. Exact, and checkable on the card. */
  creditsPerEuro: bigint;
  /**
   * Corrections at the *quoted* price, floored.
   *
   * Approximate on purpose, and the screens must say so: a correction reserves
   * 45 and settles somewhere below it, so this is a median-shaped figure. The
   * calibration document publishes the same number as "capacité médiane
   * annoncée" beside a "capacité prudente" of roughly two thirds.
   */
  approximateCorrections: bigint;
}

export function packFigures(pack: {
  credits: bigint;
  priceMinor: bigint;
}): PackFigures {
  const euros = pack.priceMinor / 100n;
  return {
    approximateCorrections: pack.credits / CORRECTION_QUOTE_CREDITS,
    bonusCredits: pack.credits - euros * PARITY_CREDITS_PER_EURO,
    creditsPerEuro: pack.credits / euros,
  };
}
