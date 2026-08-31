import { describe, expect, it, vi } from 'vitest';

import {
  CREDIT_PACK_GRID,
  ENTRY_TIER_PACK_KEY,
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
