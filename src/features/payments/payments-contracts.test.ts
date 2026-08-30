import * as z from 'zod/mini';

import {
  memberOrdersResponseSchema,
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

const preview = { computation, order, refundable: true, refusal: null };

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
        computation: null,
        order: { ...order, refundedCredits: '40', status: 'REFUNDED' },
        refundable: false,
        refusal: { code: 'ALREADY_REFUNDED', message: 'Already refunded.' },
      }).success,
    ).toBe(true);
  });

  it('refuse un montant envoyé comme nombre plutôt que comme chaîne', () => {
    // Un `BigInt` de centimes qui passe par un nombre JavaScript, c'est un
    // centime qui disparaît un jour dans un arrondi que personne n'a demandé.
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        ...preview,
        order: { ...order, amountMinor: 1900 },
      }).success,
    ).toBe(false);
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        ...preview,
        computation: { ...computation, refundedMinor: 760 },
      }).success,
    ).toBe(false);
  });

  it('refuse un état de commande hors énumération', () => {
    // Énumération fermée : un état inconnu doit arrêter la lecture, pas
    // traverser jusqu'à un libellé vide sur un écran qui parle d'argent.
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        ...preview,
        order: { ...order, status: 'CHARGEBACK' },
      }).success,
    ).toBe(false);
  });

  it('refuse une identité absente là où le serveur promet null', () => {
    // Sur un compte pseudonymisé (V4.5-166) le serveur envoie `null`. Une clé
    // manquante et une identité effacée ne disent pas la même chose, et
    // l'écran les rendrait différemment.
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        ...preview,
        order: { ...order, learner: { userId: 'user-1' } },
      }).success,
    ).toBe(false);
    expect(
      z.safeParse(refundPreviewResponseSchema, {
        ...preview,
        order: {
          ...order,
          learner: { displayName: null, email: null, userId: 'user-1' },
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
