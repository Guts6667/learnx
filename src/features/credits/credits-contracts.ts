import * as z from 'zod/mini';

/**
 * Contrats de lecture des surfaces crédits et correction (V4.5-182).
 *
 * Les types sont DÉRIVÉS de ces schémas, jamais déclarés à côté. C'est le
 * point du ticket : jusqu'ici `useObservedQuery<T>` affirmait la forme de la
 * réponse au lieu de la vérifier, donc le typecheck passait pendant que la
 * page rendait des `undefined`. C'est arrivé en V4.5-140 — le serveur avait
 * changé la forme de `/monitoring`, le type client était resté sur celle de
 * V4, et les trois fixtures du test portaient elles aussi l'ancienne forme :
 * rien, nulle part, ne comparait la page à ce que l'API renvoie vraiment.
 *
 * Une réponse qui ne correspond pas au schéma devient une erreur de requête,
 * donc un état d'erreur visible. Une page à moitié rendue, avec des champs
 * vides là où le serveur a changé de vocabulaire, est pire qu'une page qui
 * dit franchement qu'elle n'a pas pu lire la réponse.
 */

const creditProjectionPart = z.object({
  available: z.string(),
  consumed: z.string(),
  expired: z.string(),
  reserved: z.string(),
});

const creditProjection = z.object({
  free: creditProjectionPart,
  purchased: creditProjectionPart,
  totalAvailable: z.string(),
  totalReserved: z.string(),
});

const creditMemberSummarySchema = z.object({
  accountStatus: z.enum(['ACTIVE', 'PSEUDONYMISED', 'SUSPENDED']),
  displayName: z.string(),
  email: z.string(),
  projection: creditProjection,
  userId: z.string(),
});

const creditHistoryItem = z.object({
  actorUserId: z.nullable(z.string()),
  amount: z.string(),
  createdAt: z.string(),
  entryId: z.string(),
  provenance: z.enum(['FREE_ALLOCATION', 'PURCHASED']),
  reason: z.nullable(z.string()),
  referenceId: z.string(),
  referenceType: z.string(),
  type: z.string(),
});

const creditMemberDetailSchema = z.object({
  accountStatus: z.enum(['ACTIVE', 'PSEUDONYMISED', 'SUSPENDED']),
  displayName: z.string(),
  email: z.string(),
  history: z.array(creditHistoryItem),
  pendingIncreaseRequest: z.nullable(
    z.object({ createdAt: z.string(), id: z.string(), reason: z.string() }),
  ),
  projection: creditProjection,
  userId: z.string(),
});

export const creditMemberPageSchema = z.object({
  items: z.array(creditMemberSummarySchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

const creditPolicySummarySchema = z.object({
  id: z.string(),
  key: z.string(),
  status: z.enum(['ACTIVE', 'DRAFT', 'INACTIVE', 'RETIRED']),
  version: z.string(),
});

const breakerReason = z.enum([
  'CHECKER_DISAGREEMENT',
  'LEARNER_CONTRADICTION_AT_HIGH',
  'UNUSABLE_RATE',
]);

/** `null` signifie « pas assez de données », jamais zéro. */
const breakerRates = z.object({
  checkerDisagreement: z.nullable(z.number()),
  unusable: z.nullable(z.number()),
  wrongAtHigh: z.nullable(z.number()),
});

const breakerStatusSchema = z.object({
  evaluationError: z.nullable(z.string()),
  rates: breakerRates,
  reason: z.nullable(breakerReason),
  state: z.enum(['CLOSED', 'OPEN']),
  thresholds: z.object({
    checkerDisagreement: z.number(),
    unusable: z.number(),
    wrongAtHigh: z.number(),
  }),
  trippedAt: z.nullable(z.string()),
  window: z.object({ observed: z.number(), size: z.number() }),
});

export const correctionMonitoringSummarySchema = z.object({
  breaker: breakerStatusSchema,
  checker: z.object({ disagreed: z.number(), unavailable: z.number() }),
  confidence: z.object({
    high: z.number(),
    low: z.number(),
    medium: z.number(),
    scoreWithheld: z.number(),
  }),
  corrections: z.object({
    completed: z.number(),
    partial: z.number(),
    total: z.number(),
    unusable: z.number(),
  }),
  cost: z.object({
    p50Usd: z.string(),
    p90Usd: z.string(),
    totalUsd: z.string(),
    unknownCostAttempts: z.number(),
  }),
  learner: z.object({
    helpful: z.number(),
    wrong: z.number(),
    wrongAtHigh: z.number(),
  }),
});

export const correctionReleasePreflightSchema = z.object({
  apiKeyPresent: z.boolean(),
  deploymentEnvironment: z.enum(['development', 'preview', 'production']),
  identityMatches: z.boolean(),
  killSwitch: z.boolean(),
  promotedBenchmarkId: z.string(),
  state: z.enum([
    'CONFIGURATION_BLOCKED',
    'CONFIGURED_CLOSED',
    'DISABLED',
    'READY',
  ]),
});

export const creditPoliciesResponseSchema = z.object({
  policies: z.object({
    allocation: z.array(creditPolicySummarySchema),
    limits: z.array(creditPolicySummarySchema),
  }),
});

export const ownCreditsResponseSchema = z.object({
  credits: creditMemberDetailSchema,
});
export const creditMembersResponseSchema = z.object({
  page: creditMemberPageSchema,
});
export const creditMemberResponseSchema = z.object({
  member: creditMemberDetailSchema,
});
export const correctionMonitoringResponseSchema = z.object({
  monitoring: correctionMonitoringSummarySchema,
});
export const correctionPreflightResponseSchema = z.object({
  preflight: correctionReleasePreflightSchema,
});

export type CreditMemberSummary = z.infer<typeof creditMemberSummarySchema>;
export type CreditMemberDetail = z.infer<typeof creditMemberDetailSchema>;
export type BreakerStatus = z.infer<typeof breakerStatusSchema>;
export type BreakerReason = z.infer<typeof breakerReason>;
