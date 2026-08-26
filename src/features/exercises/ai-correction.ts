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

export interface CorrectionCriterionResult {
  evidenceQuotes: string[];
  evidenceStatus: 'FOUND' | 'NO_RELEVANT_EVIDENCE';
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
    overallFeedback: string | null;
    secondPassRequired: boolean;
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

export interface CorrectionHistoryEntry extends CorrectionResult {
  createdAt: string;
}

export async function requestCorrectionQuote(input: {
  idempotencyKey: string;
  targetId: string;
}): Promise<CorrectionQuote> {
  const response = await apiRequest<{ resource: { quote: CorrectionQuote } }>(
    '/api/ai-correction/quotes',
    {
      body: JSON.stringify({
        action: 'STANDARD',
        idempotencyKey: input.idempotencyKey,
        target: { id: input.targetId, kind: 'EXERCISE_SUBMISSION' },
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

export async function loadLatestCorrection(
  submissionId: string,
): Promise<CorrectionResult | null> {
  const response = await apiRequest<{
    resource: { correction: CorrectionResult | null };
  }>(
    `/api/exercise-submissions/${encodeURIComponent(submissionId)}/ai-corrections/latest`,
  );
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
