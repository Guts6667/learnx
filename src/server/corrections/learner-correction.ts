import type { OrchestratedCorrectionResult } from './correction-orchestration-contracts.js';

/** A delivery view, never a rewrite of the retained model artifact. */
export function projectLearnerCorrection(result: OrchestratedCorrectionResult) {
  const source = result.correction;
  const criteria = source.criteria.map((criterion) => {
    const confidence = criterion.confidence ?? 'LOW';
    const low = confidence === 'LOW';
    return {
      key: criterion.key,
      label: criterion.label,
      weight: criterion.weight,
      confidence,
      evidenceStatus: criterion.evidenceStatus,
      evidenceQuotes:
        criterion.evidenceStatus === 'EVIDENCE_WITHDRAWN'
          ? []
          : criterion.evidenceQuotes,
      levelKey: low ? null : criterion.levelKey,
      levelLabel: low ? null : criterion.levelLabel,
      feedback: low ? null : criterion.feedback,
    };
  });
  const incomplete =
    source.status !== 'COMPLETED' ||
    source.unsureCriteria.length > 0 ||
    criteria.length === 0 ||
    criteria.some((criterion) => criterion.confidence === 'LOW');
  return {
    correction: {
      criteria,
      id: source.id,
      indicativeScore: incomplete ? null : source.indicativeScore,
      overallConfidence: incomplete
        ? ('LOW' as const)
        : source.overallConfidence,
      overallFeedback: incomplete ? null : source.overallFeedback,
      status: source.status,
      unsureCriteria: source.unsureCriteria,
      unsureCriterionDetails: source.unsureCriterionDetails,
    },
    replay: result.replay,
    settlement: result.settlement,
  };
}
