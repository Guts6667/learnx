import { apiRequest } from '@/lib/api-client';

/**
 * V4-010 — client de la correction assistée par IA.
 * Devis (V4-007) puis exécution orchestrée (V4-009). Le consentement doit
 * précéder l'exécution : le devis énonce prix estimé, plafond réservé et la
 * possibilité de critères « à retravailler » sans compensation (doctrine du
 * Propriétaire, règle 10 de BACKLOG_V4.md).
 */

export interface CorrectionQuote {
  action: string;
  estimatedCredits: string;
  expiresAt: string;
  id: string;
  includesAutomaticSecondPass: boolean;
  maximumReservedCredits: string;
}

type CorrectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

interface CorrectionCriterionResult {
  /** Derived server-side from checkable facts, never the model's self-report. */
  confidence: CorrectionConfidence;
  evidenceQuotes: string[];
  evidenceStatus: 'FOUND' | 'NO_RELEVANT_EVIDENCE' | 'EVIDENCE_WITHDRAWN';
  feedback: string;
  key: string;
  label: string;
  levelKey: string;
  levelLabel: string;
  weight: number;
}

export interface CorrectionResult {
  correction: {
    id: string;
    criteria: CorrectionCriterionResult[];
    indicativeScore: number | null;
    overallConfidence: CorrectionConfidence;
    overallFeedback: string | null;
    status: 'COMPLETED' | 'COMPLETED_PARTIAL' | 'FAILED';
    unsureCriteria: string[];
    unsureCriterionDetails?: Array<{ key: string; label: string }>;
  };
  replay: boolean;
  settlement: {
    releasedCredits: string;
    reservedCredits: string;
    settledCredits: string;
  };
}

/** Verdict de l'apprenant sur l'utilité d'un critère (V4.5-112). */
export type CriterionFeedbackVerdict = 'HELPFUL' | 'WRONG';

export interface CorrectionHistoryEntry extends CorrectionResult {
  action?: 'STANDARD' | 'RECONSIDERATION';
  createdAt: string;
  /**
   * Verdicts déjà enregistrés, par clé de critère. Le champ est absent tant que
   * l'API ne l'expose pas : son absence masque entièrement les commandes de
   * retour, plutôt que d'afficher des boutons qui n'aboutiraient pas.
   */
  criterionFeedback?: Record<string, CriterionFeedbackVerdict>;
  sourceCorrectionId?: string | null;
}

/**
 * Idempotent par (utilisateur, correction, critère) : un second envoi remplace
 * le verdict, il n'en ajoute pas un deuxième. L'apprenant peut se raviser.
 */
export async function submitCriterionFeedback(input: {
  correctionId: string;
  criterionKey: string;
  verdict: CriterionFeedbackVerdict;
}): Promise<void> {
  await apiRequest<{
    resource: {
      feedback: {
        criterionKey: string;
        recordedAt: string;
        verdict: CriterionFeedbackVerdict;
      };
    };
  }>(`/api/ai-corrections/${encodeURIComponent(input.correctionId)}/feedback`, {
    body: JSON.stringify({
      criterionKey: input.criterionKey,
      verdict: input.verdict,
    }),
    method: 'POST',
  });
}

export async function requestCorrectionQuote(input: {
  action?: 'STANDARD' | 'RECONSIDERATION';
  argument?: string;
  idempotencyKey: string;
  sourceCorrectionId?: string;
  targetId: string;
}): Promise<CorrectionQuote> {
  const response = await apiRequest<{ resource: { quote: CorrectionQuote } }>(
    '/api/ai-correction/quotes',
    {
      body: JSON.stringify({
        action: input.action ?? 'STANDARD',
        idempotencyKey: input.idempotencyKey,
        target: {
          id: input.targetId,
          kind: 'EXERCISE_SUBMISSION',
          ...(input.action === 'RECONSIDERATION' &&
          input.argument &&
          input.sourceCorrectionId
            ? {
                reconsideration: {
                  argument: input.argument,
                  sourceCorrectionId: input.sourceCorrectionId,
                },
              }
            : {}),
        },
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    },
  );
  return response.resource.quote;
}

export async function runCorrection(input: {
  quoteId: string;
}): Promise<CorrectionResult> {
  const response = await apiRequest<{
    resource: { correction: CorrectionResult };
  }>('/api/ai-corrections', {
    body: JSON.stringify({ quoteId: input.quoteId }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  return response.resource.correction;
}

export async function loadCorrectionHistory(
  submissionId: string,
): Promise<CorrectionHistoryEntry[]> {
  const response = await apiRequest<{
    resource: { corrections: CorrectionHistoryEntry[] };
  }>(
    `/api/exercise-submissions/${encodeURIComponent(submissionId)}/ai-corrections`,
  );
  return response.resource.corrections;
}
