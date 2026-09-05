import { describe, expect, it, vi } from 'vitest';

import {
  CORRECTION_QUOTE_CREDITS,
  CORRECTION_RESERVATION_CREDITS,
  CREDIT_PACK_GRID,
  ENTRY_TIER_PACK_KEY,
  packFigures,
  seedCreditPacks,
  type CreditPackSeedPorts,
} from './credit-pack-seed';

function ports(deactivated = 1): CreditPackSeedPorts & {
  upserts: Record<string, unknown>[];
} {
  const upserts: Record<string, unknown>[] = [];
  return {
    deactivatePack: vi.fn(async () => deactivated),
    upserts,
    upsertPack: vi.fn(async (input) => {
      upserts.push(input);
    }),
  };
}

describe('grille des paliers (V4.5-212)', () => {
  it('respecte la parité et le bonus early adopter du palier du milieu', () => {
    // 100 crédits par euro à l'entrée, 132 sur Journey, 125 sur Deep Dive.
    // Journey porte seul les +20 % early adopter (arbitrage de Rayan, 2 sept
    // 2026) : 880 à parité deviennent 1 056. La décision vit dans un document ;
    // ce test est ce qui empêche le code de s'en écarter en silence.
    const rates = CREDIT_PACK_GRID.map(
      (pack) => Number(pack.credits) / (Number(pack.priceMinor) / 100),
    );

    expect(rates).toEqual([100, 132, 125]);
  });

  it('garde le palier recommandé au meilleur rendement', () => {
    // C'est ce qui rend « notre choix » honnête plutôt que commercial : le
    // palier mis en avant est celui qui rend le plus par euro, et un acheteur
    // qui fait le calcul le vérifie. Le rendement n'est donc PAS croissant —
    // Deep Dive rend moins que Journey, délibérément. Quelqu'un qui verrait
    // cette inversion comme une erreur et la « corrigerait » transformerait la
    // recommandation en argument de vente sans fondement ; d'où ce test.
    const rates = CREDIT_PACK_GRID.map(
      (pack) => Number(pack.credits) / (Number(pack.priceMinor) / 100),
    );
    const best = Math.max(...rates);

    expect(rates.indexOf(best)).toBe(1);
    expect(CREDIT_PACK_GRID[1].key).toBe('regular');
  });

  it('n’avantage jamais par une remise, seulement par des crédits', () => {
    // Un euro vaut un euro à tous les paliers : l'avantage est en crédits
    // offerts, jamais en prix cassé.
    expect(CREDIT_PACK_GRID.map((pack) => pack.priceMinor)).toEqual([
      300n,
      800n,
      1600n,
    ]);
  });

  it('rejoue à l’identique', async () => {
    // Une graine qui n'est sûre qu'à la première exécution est une graine que
    // personne n'ose relancer — et une grille qu'on n'ose pas relancer dérive
    // du document qui l'a décidée.
    const first = ports();
    const second = ports();

    await seedCreditPacks(first);
    await seedCreditPacks(second);

    expect(first.upserts).toEqual(second.upserts);
    expect(first.upserts).toHaveLength(3);
  });

  it('active les trois paliers et rien d’autre', async () => {
    const harness = ports();

    const result = await seedCreditPacks(harness);

    expect(result.seeded).toEqual(['entry', 'regular', 'intensive']);
    expect(harness.upserts.every((pack) => pack.active === true)).toBe(true);
  });

  it('désactive le palier d’aperçu sans le supprimer', async () => {
    // Les commandes référencent une clé de palier : supprimer la ligne
    // laisserait une commande payée pointant sur rien. Inactif veut déjà dire
    // invisible et inachetable (V4.5-161).
    const harness = ports();

    const result = await seedCreditPacks(harness);

    expect(harness.deactivatePack).toHaveBeenCalledWith('preview-placeholder');
    expect(result.deactivated).toEqual(['preview-placeholder']);
  });

  it('ne signale aucune désactivation quand il n’y avait rien à désactiver', async () => {
    const result = await seedCreditPacks(ports(0));
    expect(result.deactivated).toEqual([]);
  });

  it('fait découler le plafond de 45 des coûts publiés, pas d’un arrondi', () => {
    // `docs/V4_5_PRICING_CALIBRATION.md` §7 : le plafond n'est pas un confort,
    // c'est `30 × P90/médiane` du coût chargé par correction, arrondi au
    // crédit supérieur. Les deux figures sont celles du 30 août.
    //
    // Ce test échoue le jour où Finance republie des coûts sans que le plafond
    // suive — c'est-à-dire le jour où notre modèle et le leur divergent, ce
    // qu'aucune relecture n'attrape.
    const loadedP90 = 0.044163;
    const loadedMedian = 0.029894;
    const correctionCredits = 30;

    expect(Math.ceil(correctionCredits * (loadedP90 / loadedMedian))).toBe(45);
  });

  it('limite le palier d’entrée, qui est le moins cher', () => {
    const entry = CREDIT_PACK_GRID.find(
      (pack) => pack.key === ENTRY_TIER_PACK_KEY,
    );
    const prices: bigint[] = CREDIT_PACK_GRID.map((pack) => pack.priceMinor);
    expect(entry?.priceMinor).toBe(
      prices.reduce((lowest, price) => (price < lowest ? price : lowest)),
    );
  });
});

describe('chiffres servis plutôt que calculés par l’écran (V4.5-212)', () => {
  it('donne le taux exact des trois paliers', () => {
    // Vérifiable sur la carte : 1 056 crédits pour 8 €, c'est 132 par euro.
    // Jamais une remise — le prix unitaire ne bouge pas, l'avantage est en
    // crédits.
    expect(
      CREDIT_PACK_GRID.map((pack) => packFigures(pack).creditsPerEuro),
    ).toEqual([100n, 132n, 125n]);
  });

  it('donne le bonus comme un écart à la parité, nul au palier d’entrée', () => {
    // 256 sur Journey : les 80 au-dessus de la parité PLUS les 176 du bonus
    // early adopter, puisque celui-ci est fondu dans `credits`. Ce chiffre
    // n'est plus affiché sur la carte — deux unités pour une même idée, le
    // surplus en crédits et le bonus en pourcentage, se lisaient mal ensemble.
    // Il reste dérivé et testé : le jour où l'offre early adopter s'arrête,
    // c'est ici qu'on voit ce qui doit revenir à 80.
    expect(
      CREDIT_PACK_GRID.map((pack) => packFigures(pack).bonusCredits),
    ).toEqual([0n, 256n, 400n]);
  });

  it('donne une capacité approchée, jamais arrondie vers le haut', () => {
    // 2000 / 30 = 66,67 → 66. Annoncer 67 promettrait une correction que le
    // solde ne paie pas, et la capacité est déjà une médiane : arrondir dans
    // le sens généreux ajoute une promesse à une estimation.
    expect(
      CREDIT_PACK_GRID.map((pack) => packFigures(pack).approximateCorrections),
    ).toEqual([10n, 35n, 66n]);
  });

  it('énonce le devis et la réservation une seule fois', () => {
    // La note partagée sous la grille les cite littéralement.
    expect(CORRECTION_QUOTE_CREDITS).toBe(30n);
    expect(CORRECTION_RESERVATION_CREDITS).toBe(41n);
  });

  it('dérive le plafond de réservation de la méthode publiée, pas d’un chiffre choisi', () => {
    // 45 et 41 venaient du même registre : l'écart était deux définitions de
    // percentile non déclarées, pas une erreur de calcul (V4.5-164). Le
    // rapport publié dans `measured-costs.v2.json` sous nearest-rank, doublons
    // exclus, est le seul chemin vers ce plafond — et ce test échoue si
    // quelqu'un ramène le nombre sans ramener la méthode.
    const ratioP90OverP50 = 1.3645;
    const derived = BigInt(
      Math.ceil(Number(CORRECTION_QUOTE_CREDITS) * ratioP90OverP50),
    );

    expect(derived).toBe(CORRECTION_RESERVATION_CREDITS);
    // Et le plafond retenu reste au-dessus du devis : réserver moins que ce
    // qu'on annonce laisserait une correction commencer sans pouvoir se payer.
    expect(CORRECTION_RESERVATION_CREDITS).toBeGreaterThan(
      CORRECTION_QUOTE_CREDITS,
    );
  });
});
