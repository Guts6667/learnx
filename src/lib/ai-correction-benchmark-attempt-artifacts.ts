import { z } from 'zod';
import {
  correctionOutputSchema,
  protocol3CorrectionArtifactOutputSchema,
} from './ai-correction-contracts.js';
import {
  benchmarkCandidateSchema,
  exactModelIdSchema,
} from './ai-correction-benchmark-configuration.js';
import { stableKeySchema } from './ai-correction-benchmark-corpus.js';
import { benchmarkUsageSchema } from './ai-correction-benchmark-run-artifacts.js';

export const evidenceMatchSchema = z
  .object({
    criterionKey: stableKeySchema,
    matchType: z.enum(['EXACT', 'TYPOGRAPHIC_EQUIVALENT']),
    requestedQuote: z.string().min(1),
    resolvedQuote: z.string().min(1),
  })
  .strict();

const benchmarkAttemptOutputSchema = z.union([
  correctionOutputSchema,
  protocol3CorrectionArtifactOutputSchema,
]);

/**
 * Les motifs de retrait d'un critère, un par branche de rejet du rattrapage
 * (V4.5-177). Nommés séparément à dessein : voir `withdrawnCriteria`.
 *
 * Le schéma reste privé au module : seul le type sort, parce que c'est tout ce
 * que le rattrapage a besoin de nommer. Les gates de la Recherche liront la
 * valeur depuis l'artefact déjà validé ; le jour où l'un d'eux a besoin du
 * schéma lui-même, il l'exportera avec son usage plutôt qu'en avance.
 */
const criterionWithdrawalReasonSchema = z.enum([
  /** Le critère est absent de la sortie du modèle. */
  'CRITERION_ABSENT',
  /** Champs mal typés, ou `levelKey` / `evidenceStatus` inconnu. */
  'CRITERION_MALFORMED',
  /** `NO_RELEVANT_EVIDENCE` avec citations ou niveau non-plancher, ou `FOUND` sans citation. */
  'EVIDENCE_STATUS_INCONSISTENT',
  /** Canari ou fragment interdit dans le texte rendu. */
  'FORBIDDEN_CONTENT',
  /** Citation prise dans le texte d'attaque injecté. */
  'QUOTES_INJECTED_ATTACK',
  /** La citation ne se retrouve pas dans la production de l'apprenant. */
  'EVIDENCE_NOT_IN_RESPONSE',
]);

export type CriterionWithdrawalReason = z.infer<
  typeof criterionWithdrawalReasonSchema
>;

export const benchmarkAttemptSchema = z
  .object({
    attempt: z.number().int().positive(),
    candidateId: stableKeySchema,
    caseId: stableKeySchema,
    evidenceMatches: z.array(evidenceMatchSchema).optional(),
    errorCode: z.string().trim().min(1).optional(),
    latencyMs: z.number().int().nonnegative(),
    modelId: exactModelIdSchema,
    modelSnapshot: z.string().trim().min(1).optional(),
    output: benchmarkAttemptOutputSchema.optional(),
    provider: z.string().trim().min(1).optional(),
    providerRequestId: z.string().trim().min(1).optional(),
    providerRoute: z.string().trim().min(1).optional(),
    rawModelOutput: z.string().max(20_000).optional(),
    repetition: z.number().int().positive(),
    requestProfileSnapshot: benchmarkCandidateSchema.shape.requestProfile,
    requestProtocolVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: z.enum(['VALID', 'INVALID', 'ERROR']),
    unsureCriteria: z.array(stableKeySchema).optional(),
    /**
     * Pourquoi un critère a perdu son niveau, critère par critère (V4.5-177).
     *
     * Additif et optionnel : les artefacts déjà payés n'en portent pas et
     * doivent continuer à se lire. `unsureCriteria` reste ce qu'il était — la
     * liste des critères non livrés — et ce champ dit la RAISON, pour tous les
     * retraits, y compris celui d'un critère qui est malgré tout livré.
     *
     * Chaque motif est distinct par décision (AI Research) : fondre deux
     * raisons sous un même nom est exactement ce qui a fait poursuivre deux
     * fois une omission qui n'existait pas. En particulier `CRITERION_ABSENT`
     * garde un nom à lui bien qu'il vaille 0 sur l'artefact du 31 août — c'est
     * ce zéro, mesurable, qui ferme la question.
     *
     * Ordre du tableau = ordre des critères du contrat, donc déterministe.
     */
    withdrawnCriteria: z
      .array(
        z
          .object({
            criterionKey: stableKeySchema,
            reason: criterionWithdrawalReasonSchema,
          })
          .strict(),
      )
      .optional(),
    usage: benchmarkUsageSchema.optional(),
    workflowPass: z
      .enum(['PRIMARY', 'RETRY', 'SCORE_GUARD_SECOND_PASS'])
      .optional(),
  })
  .strict()
  .superRefine((attempt, context) => {
    if (
      (attempt.workflowPass === 'PRIMARY' && attempt.attempt !== 1) ||
      (attempt.workflowPass !== undefined &&
        attempt.workflowPass !== 'PRIMARY' &&
        attempt.attempt === 1)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Workflow pass kind does not match its attempt position.',
        path: ['workflowPass'],
      });
    }
    if (attempt.status === 'VALID' && !attempt.output) {
      context.addIssue({
        code: 'custom',
        message: 'A valid attempt must include a structured output.',
        path: ['output'],
      });
    }
    if (attempt.status !== 'VALID' && !attempt.errorCode) {
      context.addIssue({
        code: 'custom',
        message: 'An invalid or failed attempt must include an error code.',
        path: ['errorCode'],
      });
    }
    if (
      attempt.output &&
      !attempt.requestProtocolVersion.startsWith('3.') &&
      !correctionOutputSchema.safeParse(attempt.output).success
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Attempt output does not match its request protocol.',
        path: ['output'],
      });
    }
  });
export type BenchmarkAttempt = z.infer<typeof benchmarkAttemptSchema>;
export type EvidenceMatch = z.infer<typeof evidenceMatchSchema>;
