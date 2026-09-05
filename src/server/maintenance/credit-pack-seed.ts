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
 * Parity is 100 credits per euro; the credits shown are the totals, bonus in.
 *
 * Rayan arbitrated this grid on 2 Sept 2026 against the Conversion Edition
 * landing. The early-adopter +20 % goes to the **8 € tier only**, and it is
 * folded into `credits` rather than added at purchase time: what the card says
 * is what the ledger grants, with nothing to reconcile later.
 *
 * The consequence is deliberate, not an oversight: credits per euro run
 * 100 / 132 / 125, so the recommended tier is also the best rate and the 16 €
 * pack is worse value per euro than the 8 €. That is what makes the
 * recommendation honest — a buyer who does the arithmetic finds we meant it.
 *
 * The names are the mockup's, adopted over two objections of mine that Rayan
 * heard and overruled: "Deep Dive" qualifies the learner rather than the pack,
 * and "Journey" is the English of *Parcours*, already the domain word for a
 * programme (`navigation.programs`). They are therefore kept **untranslated in
 * both locales** — as product names they never become "Parcours" in the French
 * interface, which is what would have made the collision real.
 *
 * The one-per-account limit no longer lives in the name, as it did in "Premier
 * pack". It is served instead — `oncePerAccount` (V4.5-213) — and the card
 * states it before the purchase, refund clause included.
 */
export const CREDIT_PACK_GRID = [
  {
    credits: 300n,
    currency: 'EUR',
    key: 'entry',
    label: 'Starter',
    labelEn: 'Starter',
    position: 1,
    priceMinor: 300n,
  },
  {
    // 880 at parity plus the early-adopter 20 % (176), folded in.
    credits: 1056n,
    currency: 'EUR',
    key: 'regular',
    label: 'Journey',
    labelEn: 'Journey',
    position: 2,
    priceMinor: 800n,
  },
  {
    credits: 2000n,
    currency: 'EUR',
    key: 'intensive',
    label: 'Deep Dive',
    labelEn: 'Deep Dive',
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

/**
 * The tier the product recommends (Rayan, 2 Sept 2026).
 *
 * This reverses V4.5-213, which gave the three tiers equal weight and wrote
 * the reason into the screen: "a choice between equals, not a funnel". That
 * rule is gone, and this comment replaces it so nobody restores it from the
 * old rationale alone.
 *
 * What makes the recommendation defensible is arithmetic, not persuasion: this
 * tier carries the early-adopter 20 %, so it returns the most credits per euro
 * of the three. We are not inventing a popularity nobody measured — we are
 * pointing at the best rate and saying we chose it. If the grid ever changes
 * so that another tier pays better, this key moves with it; the seed test
 * `garde le palier recommandé au meilleur rendement` fails until it does.
 */
export const RECOMMENDED_PACK_KEY = 'regular';

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

/**
 * Ramené de 45 à 41 (V4.5-164) une fois la méthode de percentile déclarée.
 *
 * Les deux chiffres venaient du même registre et d'un désaccord non dit : la
 * voie Finance lisait un P90 de 0,032591, la voie Recherche 0,029748. L'écart
 * n'était pas une erreur de calcul mais deux définitions de percentile, dont
 * aucune n'était écrite. `measured-costs.v2.json` déclare la méthode retenue —
 * nearest-rank, sans interpolation, doublons exclus — et le plafond en découle
 * : P90/P50 = 1,3645, appliqué à un devis de 30 crédits, donne 40,9 → 41.
 *
 * Retenir 45 sur un devis de 30 immobilisait la moitié d'une correction de plus
 * que la mesure ne le justifie, sur le solde d'un apprenant.
 */
export const CORRECTION_RESERVATION_CREDITS = 41n;

export interface PackFigures {
  /** Credits beyond parity for this price. Zero at the entry tier. */
  bonusCredits: bigint;
  /** Credits per euro: 100, 110, 125. Exact, and checkable on the card. */
  creditsPerEuro: bigint;
  /**
   * Corrections at the *quoted* price, floored.
   *
   * Approximate on purpose, and the screens must say so: a correction reserves
   * 41 and settles somewhere below it, so this is a median-shaped figure. The
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
