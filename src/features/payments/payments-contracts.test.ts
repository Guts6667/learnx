import * as z from 'zod/mini';

import {
  checkoutResponseSchema,
  creditPacksResponseSchema,
  memberOrdersResponseSchema,
  ownOrdersResponseSchema,
  refundPreviewResponseSchema,
} from '@/features/payments/payments-contracts';

/**
 * Ce fichier ancre l'écran de remboursement à ce que le serveur renvoie
 * vraiment. La leçon est celle de V4.5-140 : les fixtures d'un test de page
 * décrivent ce qu'on CROIT que l'API renvoie, et rien ne le vérifiait — la
 * page rendait des `undefined` pendant que le test restait vert.
 *
 * Ici il s'agit d'argent, donc deux règles s'ajoutent et sont testées comme
 * telles : un montant est une chaîne, jamais un nombre JavaScript ; et un
 * champ absent n'est pas un champ nul.
 */

const computation = {
  expectedRemainingOnLot: '40',
  packCredits: '100',
  packPriceMinor: '1900',
  projectedWriteOffCredits: '0',
  reclaimedCredits: '40',
  refundedMinor: '760',
  remainingOnLot: '40',
};

const order = {
  amountMinor: '1900',
  createdAt: '2026-08-01T10:00:00.000Z',
  currency: 'EUR',
  fulfilledAt: '2026-08-01T10:00:05.000Z',
  id: 'order-1',
  learner: {
    displayName: 'Apprenant',
    email: 'learner@example.com',
    userId: 'user-1',
  },
  packKey: 'pack-100',
  refundedCredits: '0',
  status: 'FULFILLED',
  writtenOffCredits: '0',
};

const preview = {
  resource: { computation, order, refundable: true, refusal: null },
};

describe('contrats de paiement', () => {
  it('accepte la forme gelée de l’aperçu', () => {
    expect(z.safeParse(refundPreviewResponseSchema, preview).success).toBe(
      true,
    );
  });

  it('accepte un aperçu non remboursable, calcul absent et motif présent', () => {
    // `computation: null` est délibéré : afficher « Rembourser 0,00 € » serait
    // la fausse valeur du défaut. Les chiffres du passé restent sous `order`.
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        resource: {
          computation: null,
          order: { ...order, refundedCredits: '40', status: 'REFUNDED' },
          refundable: false,
          refusal: { code: 'ALREADY_REFUNDED', message: 'Already refunded.' },
        },
      }).success,
    ).toBe(true);
  });

  it('refuse un montant envoyé comme nombre plutôt que comme chaîne', () => {
    // Un `BigInt` de centimes qui passe par un nombre JavaScript, c'est un
    // centime qui disparaît un jour dans un arrondi que personne n'a demandé.
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        resource: {
          ...preview.resource,
          order: { ...order, amountMinor: 1900 },
        },
      }).success,
    ).toBe(false);
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        resource: {
          ...preview.resource,
          computation: { ...computation, refundedMinor: 760 },
        },
      }).success,
    ).toBe(false);
  });

  it('refuse un état de commande hors énumération', () => {
    // Énumération fermée : un état inconnu doit arrêter la lecture, pas
    // traverser jusqu'à un libellé vide sur un écran qui parle d'argent.
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        resource: {
          ...preview.resource,
          order: { ...order, status: 'CHARGEBACK' },
        },
      }).success,
    ).toBe(false);
  });

  it('refuse une identité absente là où le serveur promet null', () => {
    // Sur un compte pseudonymisé (V4.5-166) le serveur envoie `null`. Une clé
    // manquante et une identité effacée ne disent pas la même chose, et
    // l'écran les rendrait différemment.
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        resource: {
          ...preview.resource,
          order: { ...order, learner: { userId: 'user-1' } },
        },
      }).success,
    ).toBe(false);
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        resource: {
          ...preview.resource,
          order: {
            ...order,
            learner: { displayName: null, email: null, userId: 'user-1' },
          },
        },
      }).success,
    ).toBe(true);
  });

  it('accepte la liste des commandes paginée par décalage', () => {
    expect(
      z.safeParse(memberOrdersResponseSchema, {
        page: {
          items: [
            {
              amountMinor: '1900',
              createdAt: '2026-08-01T10:00:00.000Z',
              currency: 'EUR',
              fulfilledAt: null,
              id: 'order-1',
              packKey: 'pack-100',
              refundedCredits: '0',
              status: 'PENDING',
              writtenOffCredits: '0',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        },
      }).success,
    ).toBe(true);
  });
});

/**
 * Les surfaces d'achat (V4.5-204), relevées sur les routes livrées par
 * V4.5-205 et non sur ce qu'on croyait qu'elles renverraient. Les fixtures
 * ci-dessous reprennent exactement celles de `src/server/api/credits/app.test`.
 */
describe('contrats d’achat de crédits', () => {
  const pack = {
    approximateCorrections: '0',
    bonusCredits: '-1490',
    credits: '10',
    creditsPerEuro: '0',
    currency: 'EUR',
    key: 'starter',
    label: 'Découverte',
    labelEn: 'Starter',
    oncePerAccount: false,
    priceMinor: '1500',
  };
  const shared = {
    correctionQuoteCredits: '30',
    correctionReservationCredits: '41',
  };
  const order = {
    amountMinor: '1500',
    createdAt: '2026-08-30T17:49:00.000Z',
    currency: 'EUR',
    fulfilledAt: '2026-08-30T17:49:29.000Z',
    id: 'c725ed24-0000-4000-8000-000000000001',
    packKey: 'starter',
    status: 'FULFILLED',
  };

  it('accepte la forme livrée du catalogue et des commandes', () => {
    expect(
      z.safeParse(creditPacksResponseSchema, {
        ...shared,
        packs: [pack],
        paymentsEnabled: true,
      }).success,
    ).toBe(true);
    // L'état de la vente n'est pas optionnel : un écran qui le devine quand il
    // manque devinerait « ouverte », et proposerait un achat qui échoue.
    expect(
      z.safeParse(creditPacksResponseSchema, { ...shared, packs: [pack] })
        .success,
    ).toBe(false);

    // Le libellé anglais non plus : servi à côté du français pour qu'un seul
    // corps mis en cache serve tout le monde, il manquerait silencieusement à
    // l'écran anglais si le schéma le tolérait absent.
    const frenchOnly = Object.fromEntries(
      Object.entries(pack).filter(([key]) => key !== 'labelEn'),
    );
    expect(
      z.safeParse(creditPacksResponseSchema, {
        ...shared,
        packs: [frenchOnly],
        paymentsEnabled: true,
      }).success,
    ).toBe(false);
    // Ni la condition d'achat : `purchasable` dit « ce compte peut-il acheter
    // maintenant » et vaut vrai partout ailleurs, donc lui seul ne peut pas
    // signaler la limite avant le premier achat. Absent, le champ ferait taire
    // la phrase que Rayan a demandé d'afficher AVANT l'achat (V4.5-213).
    const withoutCondition = Object.fromEntries(
      Object.entries(pack).filter(([key]) => key !== 'oncePerAccount'),
    );
    expect(
      z.safeParse(creditPacksResponseSchema, {
        ...shared,
        packs: [withoutCondition],
        paymentsEnabled: true,
      }).success,
    ).toBe(false);
    expect(
      z.safeParse(ownOrdersResponseSchema, { orders: [order] }).success,
    ).toBe(true);
    // Une commande non honorée n'a pas de date d'attribution ; `null` et
    // « champ absent » ne disent pas la même chose et le schéma les sépare.
    expect(
      z.safeParse(ownOrdersResponseSchema, {
        orders: [{ ...order, fulfilledAt: null, status: 'PENDING' }],
      }).success,
    ).toBe(true);
  });

  it('refuse un prix ou un nombre de crédits envoyé comme nombre', () => {
    expect(
      z.safeParse(creditPacksResponseSchema, {
        packs: [{ ...pack, priceMinor: 1500 }],
      }).success,
    ).toBe(false);
    expect(
      z.safeParse(creditPacksResponseSchema, {
        packs: [{ ...pack, credits: 10 }],
      }).success,
    ).toBe(false);
  });

  it('refuse un état de commande hors énumération côté apprenant aussi', () => {
    expect(
      z.safeParse(ownOrdersResponseSchema, {
        orders: [{ ...order, status: 'CHARGEBACK' }],
      }).success,
    ).toBe(false);
  });

  it('exige une URL de paiement avant toute redirection', () => {
    expect(
      z.safeParse(checkoutResponseSchema, {
        resource: {
          checkout: {
            correctionSuspended: false,
            orderId: 'order-1',
            url: 'https://checkout.stripe.com/c/pay/cs_test_1',
          },
        },
      }).success,
    ).toBe(true);
    // Rediriger sans URL n'enverrait nulle part ; ne pas savoir si la
    // correction est suspendue ferait vendre en silence. Ni l'un ni l'autre
    // ne passe.
    expect(
      z.safeParse(checkoutResponseSchema, {
        resource: { checkout: { correctionSuspended: false, orderId: 'o' } },
      }).success,
    ).toBe(false);
    expect(
      z.safeParse(checkoutResponseSchema, {
        resource: { checkout: { orderId: 'o', url: 'https://example.test' } },
      }).success,
    ).toBe(false);
  });
});
