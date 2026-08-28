import type {
  CorrectionContract,
  Protocol3CorrectionArtifactOutput,
} from '../../lib/ai-correction-contracts.js';
import type { CorrectionMonitoringSignal } from './correction-monitoring.js';
import type { OrchestratedCorrectionResult } from './correction-orchestration-contracts.js';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';

export function weightedIndicativeScore(
  contract: CorrectionContract,
  output: Protocol3CorrectionArtifactOutput,
): number {
  const deliveredWeight = output.criteria.reduce(
    (total, item) =>
      total +
      (contract.criteria.find(
        (candidate) => candidate.key === item.criterionKey,
      )?.weight ?? 0),
    0,
  );
  if (deliveredWeight <= 0) return 0;
  const total = output.criteria.reduce((sum, item) => {
    const criterion = contract.criteria.find(
      (candidate) => candidate.key === item.criterionKey,
    );
    const score = criterion?.performanceLevels.find(
      (level) => level.key === item.levelKey,
    )?.score;
    return (
      sum + (criterion && score !== undefined ? criterion.weight * score : 0)
    );
  }, 0);
  return Math.round((total / deliveredWeight) * 100) / 100;
}

function criterionLevelLabel(
  contract: CorrectionContract,
  criterionKey: string,
  levelKey: string,
): string {
  return (
    contract.criteria
      .find((criterion) => criterion.key === criterionKey)
      ?.performanceLevels.find((level) => level.key === levelKey)?.label ??
    levelKey
  );
}

function detectsHardConstraintMismatch(
  contract: CorrectionContract,
  output: Protocol3CorrectionArtifactOutput,
): boolean {
  const hardConstraint =
    /\b(contrainte|interdit(?:e|es|s)?|violation|constraint|forbidden)\b/i;
  return output.criteria.some((item) => {
    if (!hardConstraint.test(item.feedback)) return false;
    const criterion = contract.criteria.find(
      (candidate) => candidate.key === item.criterionKey,
    );
    const selected = criterion?.performanceLevels.find(
      (level) => level.key === item.levelKey,
    );
    const minimum = criterion?.performanceLevels.reduce(
      (lowest, level) => Math.min(lowest, level.score),
      Number.POSITIVE_INFINITY,
    );
    return (
      selected !== undefined &&
      minimum !== undefined &&
      selected.score > minimum
    );
  });
}

export function buildCorrectionOutcome(input: {
  contract: CorrectionContract;
  forceScoreGuardSecondPass?: boolean;
  output: Protocol3CorrectionArtifactOutput;
  unsureCriteria: string[];
  usageCost: number | null;
}): OrchestratedCorrectionResult['correction'] {
  const deliveredAll = input.unsureCriteria.length === 0;
  const score = deliveredAll
    ? weightedIndicativeScore(input.contract, input.output)
    : null;
  const guarded =
    input.forceScoreGuardSecondPass === true ||
    (score !== null &&
      Math.abs(score - input.contract.passingScore) <=
        PROMOTED_CORRECTION_IDENTITY.scoreGuardBandPoints);
  const monitoringSignals: CorrectionMonitoringSignal[] = [];
  if (guarded) monitoringSignals.push('SCORE_GUARD_TRIGGERED');
  if (detectsHardConstraintMismatch(input.contract, input.output)) {
    monitoringSignals.push('HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED');
  }
  return {
    id: '',
    status: deliveredAll && !guarded ? 'COMPLETED' : 'COMPLETED_PARTIAL',
    criteria: input.output.criteria.map((item) => {
      const criterion = input.contract.criteria.find(
        (candidate) => candidate.key === item.criterionKey,
      );
      return {
        key: item.criterionKey,
        label: criterion?.label ?? item.criterionKey,
        weight: criterion?.weight ?? 0,
        levelKey: item.levelKey,
        levelLabel: criterionLevelLabel(
          input.contract,
          item.criterionKey,
          item.levelKey,
        ),
        evidenceStatus: item.evidenceStatus,
        evidenceQuotes: item.evidenceQuotes,
        feedback: item.feedback,
      };
    }),
    unsureCriteria: input.unsureCriteria,
    unsureCriterionDetails: input.unsureCriteria.map((key) => ({
      key,
      label:
        input.contract.criteria.find((criterion) => criterion.key === key)
          ?.label ?? key,
    })),
    overallFeedback: input.output.overallFeedback,
    indicativeScore: guarded ? null : score,
    secondPassRequired: guarded,
    modelUsageCostUsd: input.usageCost,
    monitoringSignals,
  };
}

export function failedCorrection(
  contract: CorrectionContract,
  usageCost: number | null,
  guarded: boolean,
): OrchestratedCorrectionResult['correction'] {
  return {
    id: '',
    status: 'FAILED',
    criteria: [],
    unsureCriteria: guarded ? contract.criteria.map(({ key }) => key) : [],
    unsureCriterionDetails: guarded
      ? contract.criteria.map(({ key, label }) => ({ key, label }))
      : [],
    overallFeedback: null,
    indicativeScore: null,
    secondPassRequired: guarded,
    modelUsageCostUsd: usageCost,
    monitoringSignals: guarded ? ['SCORE_GUARD_TRIGGERED'] : [],
  };
}
