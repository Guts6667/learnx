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

/**
 * L'aperçu est enveloppé dans `resource`, là où la liste l'est dans `page` :
 * c'est la forme que la route renvoie réellement (vérifiée contre
 * `payment-refund-routes.ts` après fusion, pas supposée d'après la spec).
 */
export const refundPreviewResponseSchema = z.object({
  resource: z.object({
    computation: z.nullable(refundComputationSchema),
    order: refundOrderSchema,
    refundable: z.boolean(),
    refusal: z.nullable(
      z.object({ code: refundRefusalCodeSchema, message: z.string() }),
    ),
  }),
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
 * Un palier achetable, relevé sur `GET /api/credits/packs` (V4.5-205).
 *
 * Seuls les paliers actifs y figurent, et le serveur les rend dans l'ordre que
 * le propriétaire a arrangé (`position` puis `key`). Cette colonne n'est pas
 * exposée, et c'est cohérent : l'ordre est une décision, pas une donnée que
 * l'écran aurait à réappliquer. On rend donc la liste telle qu'elle arrive.
 *
 * Inactif veut dire invisible ET inachetable côté serveur : un palier montré
 * puis refusé au clic serait un prix affiché que personne n'a arbitré.
 */
const creditPackSchema = z.object({
  credits: z.string(),
  currency: z.string(),
  key: z.string(),
  label: z.string(),
  /**
   * Servi à côté du français plutôt que résolu côté serveur (V4.5-212) :
   * `/api/public/credit-packs` est mis en cache « le même pour tout le monde »,
   * et une réponse qui dépend de la langue demanderait un `Vary`. L'écran
   * choisit — il connaît déjà sa langue.
   */
  labelEn: z.string(),
  priceMinor: z.string(),
});

export const creditPacksResponseSchema = z.object({
  packs: z.array(creditPackSchema),
  /**
   * L'état de la vente, servi avec le catalogue parce que l'écran a besoin des
   * deux ensemble (V4.5-205). Sans lui, une vente fermée ne s'apprend qu'au 503
   * d'un achat déjà proposé. Les packs restent listés dans ce cas : l'écran
   * explique, au lieu d'afficher une page vide qui ressemble à une panne.
   */
  paymentsEnabled: z.boolean(),
});

/**
 * Les commandes de l'apprenant, relevées sur `GET /api/credits/orders`.
 *
 * Volontairement plus étroit que la ligne d'administration : ni identifiant de
 * session Stripe, ni crédits repris. Ce n'est pas un oubli de la voie A mais
 * une décision — un écran qui ne reçoit jamais l'identifiant du prestataire ne
 * peut pas le laisser fuir dans une URL, un journal ou une capture d'écran de
 * support. Le schéma dit donc la même chose : ces champs ne sont pas attendus.
 *
 * Pas de pagination : la liste arrive entière, la plus récente en tête.
 */
const ownPaymentOrderSchema = z.object({
  amountMinor: z.string(),
  createdAt: z.string(),
  currency: z.string(),
  fulfilledAt: z.nullable(z.string()),
  id: z.string(),
  packKey: z.string(),
  status: paymentOrderStatusSchema,
});

export const ownOrdersResponseSchema = z.object({
  orders: z.array(ownPaymentOrderSchema),
});

/**
 * La réponse de `POST /api/credits/checkout`, relevée sur `checkout-route.ts`.
 *
 * `correctionSuspended` est le fait que l'API tient à dire elle-même plutôt
 * que de compter sur un écran pour le dire : la correction peut être suspendue
 * au moment de l'achat, et les crédits achetés gardent leur valeur pour sa
 * reprise. L'écran s'arrête donc avant la redirection quand il est vrai.
 */
export const checkoutResponseSchema = z.object({
  resource: z.object({
    checkout: z.object({
      correctionSuspended: z.boolean(),
      orderId: z.string(),
      url: z.string(),
    }),
  }),
});

/**
 * Le POST ne rend pas de schéma ici, volontairement. Sa réponse répète des
 * chiffres que l'aperçu et la ligne de commande portent déjà ; après un
 * remboursement on relit les deux au lieu d'afficher l'écho. Une seule forme
 * de la vérité à l'écran, et une de moins à tenir alignée avec le serveur.
 */

export type CreditPack = z.infer<typeof creditPackSchema>;
export type OwnPaymentOrder = z.infer<typeof ownPaymentOrderSchema>;
export type PaymentOrderLine = z.infer<typeof paymentOrderLineSchema>;
