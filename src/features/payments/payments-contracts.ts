import * as z from 'zod/mini';

/**
 * Contrats de lecture des surfaces de paiement (V4.5-162).
 *
 * Mêmes règles qu'en V4.5-182 : les types sont DÉRIVÉS des schémas, jamais
 * déclarés à côté, et une réponse hors schéma devient une erreur visible
 * plutôt qu'un écran à moitié rendu.
 *
 * Deux règles propres à l'argent s'y ajoutent.
 *
 * Les montants sont des CHAÎNES, toujours. Ce sont des `BigInt` en plus petite
 * unité monétaire côté serveur ; les faire passer par un nombre JavaScript,
 * c'est accepter qu'un jour un centime disparaisse dans un arrondi que
 * personne n'a demandé.
 *
 * Le prorata n'est JAMAIS calculé ici. `voluntaryRefundMinor` vit côté serveur
 * et l'énonce une seule fois, arrondi au demi supérieur sur des entiers. Le
 * navigateur affiche ce que le serveur a calculé ; il ne le recalcule pas,
 * sans quoi les deux formes de la même vérité finiraient par diverger — c'est
 * exactement ce qui s'était produit en V4.5-140.
 */

/**
 * Les onze états, en noms bruts d'énumération. L'énumération est fermée : un
 * état inconnu doit arrêter la lecture, pas traverser jusqu'à un libellé vide.
 */
const paymentOrderStatusSchema = z.enum([
  'CREATED',
  'DISPUTE_LOST',
  'DISPUTE_WON',
  'DISPUTED',
  'EXPIRED',
  'FAILED',
  'FULFILLED',
  'PAID',
  'PENDING',
  'REFUND_PENDING',
  'REFUNDED',
]);

/**
 * Pourquoi un remboursement volontaire est refusé. Le code porte tout le sens :
 * l'interface est bilingue et rend ses libellés depuis ce code, jamais depuis
 * le `message` du serveur, qui n'est pas traduit et part aux journaux.
 *
 * `DISPUTE_WON` n'y figure pas : la banque a tranché en notre faveur, l'argent
 * est à nous, et un remboursement commercial reste la décision de
 * l'administrateur (règle produit). L'écran montre le litige gagné en contexte.
 */
const refundRefusalCodeSchema = z.enum([
  'ALREADY_REFUNDED',
  'DISPUTE_LOST',
  'NOT_FULFILLED',
  'REFUND_PENDING',
  'UNDER_DISPUTE',
]);

const paymentOrderLineSchema = z.object({
  amountMinor: z.string(),
  createdAt: z.string(),
  currency: z.string(),
  fulfilledAt: z.nullable(z.string()),
  id: z.string(),
  packKey: z.string(),
  refundedCredits: z.string(),
  status: paymentOrderStatusSchema,
  writtenOffCredits: z.string(),
});

/**
 * `null` sur un compte pseudonymisé (V4.5-166) : le champ est absent, donc
 * masqué. Une chaîne vide se rendrait comme un nom manquant plutôt que comme
 * une identité effacée, et les deux ne disent pas la même chose.
 */
const refundLearnerSchema = z.object({
  displayName: z.nullable(z.string()),
  email: z.nullable(z.string()),
  userId: z.string(),
});

const refundOrderSchema = z.object({
  amountMinor: z.string(),
  createdAt: z.string(),
  currency: z.string(),
  fulfilledAt: z.nullable(z.string()),
  id: z.string(),
  learner: refundLearnerSchema,
  packKey: z.string(),
  /** Constaté : ce qui a déjà été repris. À ne pas confondre avec le projeté. */
  refundedCredits: z.string(),
  status: paymentOrderStatusSchema,
  /** Constaté, lui aussi. Le projeté vit dans `computation`, sous un autre nom. */
  writtenOffCredits: z.string(),
});

/**
 * Le calcul, tel que le serveur l'a fait. `null` quand la commande n'est pas
 * remboursable : afficher « Rembourser 0,00 € » serait la fausse valeur du
 * défaut, alors que les chiffres du passé restent lisibles sous `order`.
 */
const refundComputationSchema = z.object({
  /**
   * Le solde du lot sur lequel l'aperçu engage le serveur. Le POST doit le
   * renvoyer tel quel : si l'apprenant a consommé des crédits entre les deux
   * temps, le serveur répond 409 PREVIEW_STALE au lieu de rembourser un
   * montant que personne n'a approuvé.
   */
  expectedRemainingOnLot: z.string(),
  packCredits: z.string(),
  packPriceMinor: z.string(),
  /**
   * Valeur qu'aucun crédit ne couvrirait. Sous la politique volontaire,
   * l'invariant `assertNoWriteOff` la maintient à « 0 » ; le champ existe pour
   * les contestations, où il peut être autre chose.
   */
  projectedWriteOffCredits: z.string(),
  reclaimedCredits: z.string(),
  refundedMinor: z.string(),
  /** Le solde constaté à la lecture. `expectedRemainingOnLot` en est le jeton. */
  remainingOnLot: z.string(),
});

export const refundPreviewResponseSchema = z.object({
  computation: z.nullable(refundComputationSchema),
  order: refundOrderSchema,
  refundable: z.boolean(),
  refusal: z.nullable(
    z.object({ code: refundRefusalCodeSchema, message: z.string() }),
  ),
});

export const memberOrdersResponseSchema = z.object({
  page: z.object({
    items: z.array(paymentOrderLineSchema),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

/**
 * Le POST ne rend pas de schéma ici, volontairement. Sa réponse répète des
 * chiffres que l'aperçu et la ligne de commande portent déjà ; après un
 * remboursement on relit les deux au lieu d'afficher l'écho. Une seule forme
 * de la vérité à l'écran, et une de moins à tenir alignée avec le serveur.
 */

export type PaymentOrderLine = z.infer<typeof paymentOrderLineSchema>;
