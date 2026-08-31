import type { TranslationOf } from '@/i18n/catalogs/types';

/**
 * La carte d'un palier de crédits (V4.5-213).
 *
 * Un seul jeu de clés pour les deux surfaces qui l'affichent — l'écran
 * d'achat et la section tarifs publique. Elles n'ont ni la même mise en page
 * ni la même action, mais elles disent les mêmes chiffres sur le même produit,
 * et deux jeux de phrases divergeraient : celui qu'on n'a pas sous les yeux
 * n'est pas celui qu'on relit. Les phrases propres à une surface restent chez
 * elle (`credits.purchase.*`, `landing.pricing.*`).
 *
 * Aucun chiffre n'est écrit ici : le taux, le bonus, la capacité, le devis et
 * la réserve arrivent du serveur (V4.5-212) et ne passent que par
 * l'interpolation. Une valeur en dur dans une phrase serait un chiffre sur de
 * l'argent que rien ne fait rougir quand la grille change.
 */
export const frenchCreditPackMessages = {
  'creditPack.rate': '{rate} crédits par euro',
  'creditPack.bonus': '{bonus} crédits en plus',
  'creditPack.approximateCorrections': {
    one: 'environ {corrections} correction',
    other: 'environ {corrections} corrections',
  },
  /**
   * Dite avant l'achat, pas au refus : à ce montant, la découvrir après coup
   * coûterait un achat. La seconde phrase est l'arbitrage écrit de Rayan du
   * 31 août 2026 — le droit se compte sur l'achat honoré, pas sur l'argent
   * gardé, et `purchasableByUser` le lit sur `fulfilledAt` pour cette raison.
   */
  'creditPack.oncePerAccount':
    'Un seul achat par compte : à ce montant, les frais fixes du paiement absorbent une part disproportionnée. Un remboursement ne rouvre pas ce droit.',
  'creditPack.alreadyPurchased':
    'Déjà acheté. Ce pack est limité à un achat par compte. Les autres paliers restent disponibles.',
  /**
   * Sous la grille et non sur chaque carte : elle porte sur la correction, pas
   * sur un palier, et répétée trois fois elle se lirait comme une clause.
   */
  'creditPack.correctionNote':
    'Une correction est devisée à {quote} crédits et en réserve {reservation} ; ce qui n’est pas utilisé vous est rendu aussitôt.',
} as const;

export const englishCreditPackMessages = {
  'creditPack.rate': '{rate} credits per euro',
  'creditPack.bonus': '{bonus} extra credits',
  'creditPack.approximateCorrections': {
    one: 'about {corrections} correction',
    other: 'about {corrections} corrections',
  },
  'creditPack.oncePerAccount':
    'One purchase per account: at this amount, the payment’s fixed fee takes a disproportionate share. A refund does not reopen it.',
  'creditPack.alreadyPurchased':
    'Already purchased. This pack is limited to one purchase per account. The other tiers remain available.',
  'creditPack.correctionNote':
    'A correction is quoted at {quote} credits and reserves {reservation}; whatever is not used is returned to you straight away.',
} as const satisfies TranslationOf<typeof frenchCreditPackMessages>;
