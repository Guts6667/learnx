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
  it('respecte la parité et les deux bonus de la calibration', () => {
    // 100 crédits par euro au palier d'entrée, 110 puis 125 ensuite. La
    // décision vit dans un document ; ce test est ce qui empêche le code de
    // s'en écarter en silence.
    const rates = CREDIT_PACK_GRID.map(
      (pack) => Number(pack.credits) / (Number(pack.priceMinor) / 100),
    );

    expect(rates).toEqual([100, 110, 125]);
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
    // Vérifiable sur la carte : 880 crédits pour 8 €, c'est 110 par euro.
    // Jamais une remise — le prix unitaire ne bouge pas.
    expect(
      CREDIT_PACK_GRID.map((pack) => packFigures(pack).creditsPerEuro),
    ).toEqual([100n, 110n, 125n]);
  });

  it('donne le bonus comme un écart à la parité, nul au palier d’entrée', () => {
    expect(
      CREDIT_PACK_GRID.map((pack) => packFigures(pack).bonusCredits),
    ).toEqual([0n, 80n, 400n]);
  });

  it('donne une capacité approchée, jamais arrondie vers le haut', () => {
    // 2000 / 30 = 66,67 → 66. Annoncer 67 promettrait une correction que le
    // solde ne paie pas, et la capacité est déjà une médiane : arrondir dans
    // le sens généreux ajoute une promesse à une estimation.
    expect(
      CREDIT_PACK_GRID.map((pack) => packFigures(pack).approximateCorrections),
    ).toEqual([10n, 29n, 66n]);
  });

  it('énonce le devis et la réservation une seule fois', () => {
    // La note partagée sous la grille les cite littéralement.
    expect(CORRECTION_QUOTE_CREDITS).toBe(30n);
    expect(CORRECTION_RESERVATION_CREDITS).toBe(45n);
  });
});
