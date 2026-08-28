import type { CorrectionBenchmarkConfiguration } from './ai-correction-benchmark-configuration.js';
import type { ModelBenchmarkMetrics } from './ai-correction-benchmark-types.js';
import {
  ordinalLevelDistance,
  weightedDecisionScore,
  type BenchmarkCase,
  type BenchmarkContract,
  type ValidBenchmarkAttempt,
} from './ai-correction-benchmark-summary-support.js';

type FamilyAggregate = {
  criterionCount: number;
  criterionMatches: number;
  decisionCount: number;
  decisionMatches: number;
  falseFailCount: number;
  falsePassCount: number;
  goldFailCount: number;
  goldPassCount: number;
  logicalRuns: number;
  ordinalDistanceTotal: number;
};

export type DecisionMetrics = {
  byFamily: ModelBenchmarkMetrics['byFamily'];
  criterionAgreement: number;
  decisionAgreement: number;
  decisionAgreementExcludingSecondPass: number;
  eliminatoryHumanReviewFindings: ModelBenchmarkMetrics['eliminatoryHumanReviewFindings'];
  falseFailCount: number;
  falseFailRate: number;
  falsePassCount: number;
  falsePassRate: number;
  meanCalibrationError: number;
  meanOrdinalDistance: number;
  ordinalConfusionMatrix: Record<string, Record<string, number>>;
  twoLevelOrdinalGapCount: number;
};

function emptyFamilyAggregate(): FamilyAggregate {
  return {
    criterionCount: 0,
    criterionMatches: 0,
    decisionCount: 0,
    decisionMatches: 0,
    falseFailCount: 0,
    falsePassCount: 0,
    goldFailCount: 0,
    goldPassCount: 0,
    logicalRuns: 0,
    ordinalDistanceTotal: 0,
  };
}

function serializeFamilies(
  familyAggregates: Map<string, FamilyAggregate>,
): ModelBenchmarkMetrics['byFamily'] {
  return Object.fromEntries(
    [...familyAggregates.entries()].map(([family, aggregate]) => [
      family,
      {
        criterionAgreement:
          aggregate.criterionCount === 0
            ? 0
            : aggregate.criterionMatches / aggregate.criterionCount,
        decisionAgreement:
          aggregate.decisionCount === 0
            ? 0
            : aggregate.decisionMatches / aggregate.decisionCount,
        falseFailCount: aggregate.falseFailCount,
        falseFailRate:
          aggregate.goldPassCount === 0
            ? 0
            : aggregate.falseFailCount / aggregate.goldPassCount,
        falsePassCount: aggregate.falsePassCount,
        falsePassRate:
          aggregate.goldFailCount === 0
            ? 0
            : aggregate.falsePassCount / aggregate.goldFailCount,
        logicalRuns: aggregate.logicalRuns,
        meanOrdinalDistance:
          aggregate.criterionCount === 0
            ? 0
            : aggregate.ordinalDistanceTotal / aggregate.criterionCount,
      },
    ]),
  );
}

export function calculateDecisionMetrics(input: {
  validAttempts: ValidBenchmarkAttempt[];
  casesById: Map<string, BenchmarkCase>;
  contractsByKey: Map<string, BenchmarkContract>;
  configuration: CorrectionBenchmarkConfiguration;
  scoreGuardRoutedRuns: Set<string>;
  ordinalLevelKeys: string[];
}): DecisionMetrics {
  let criterionCount = 0;
  let criterionMatches = 0;
  let confidenceError = 0;
  let decisionCount = 0;
  let decisionMatches = 0;
  let certainDecisionCount = 0;
  let certainDecisionMatches = 0;
  let falseFailCount = 0;
  let falsePassCount = 0;
  let goldFailCount = 0;
  let goldPassCount = 0;
  let ordinalDistanceTotal = 0;
  const ordinalConfusionMatrix: Record<string, Record<string, number>> = {};
  const eliminatoryHumanReviewFindings: ModelBenchmarkMetrics['eliminatoryHumanReviewFindings'] =
    [];
  const familyAggregates = new Map<string, FamilyAggregate>();

  input.validAttempts.forEach((attempt) => {
    const benchmarkCase = input.casesById.get(attempt.caseId);
    if (!benchmarkCase)
      throw new Error(`Unknown benchmark case: ${attempt.caseId}`);
    const contract = input.contractsByKey.get(
      `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
    );
    if (!contract)
      throw new Error(
        `Unknown benchmark contract: ${benchmarkCase.contractKey}`,
      );
    const family = contract.target.activityType;
    const familyAggregate =
      familyAggregates.get(family) ?? emptyFamilyAggregate();
    const expected = new Map(
      benchmarkCase.expectedCriteria.map((criterion) => [
        criterion.criterionKey,
        criterion.levelKey,
      ]),
    );
    attempt.output.criteria.forEach((criterion) => {
      const expectedLevelKey = expected.get(criterion.criterionKey);
      if (!expectedLevelKey)
        throw new Error('BENCHMARK_EXPECTED_CRITERION_MISSING');
      const matches = expectedLevelKey === criterion.levelKey;
      const distance = ordinalLevelDistance({
        actualLevelKey: criterion.levelKey,
        contract,
        criterionKey: criterion.criterionKey,
        expectedLevelKey,
      });
      criterionCount += 1;
      criterionMatches += matches ? 1 : 0;
      confidenceError += Math.abs(criterion.confidence - (matches ? 1 : 0));
      ordinalDistanceTotal += distance;
      familyAggregate.criterionCount += 1;
      familyAggregate.criterionMatches += matches ? 1 : 0;
      familyAggregate.ordinalDistanceTotal += distance;
      ordinalConfusionMatrix[expectedLevelKey] ??= {};
      ordinalConfusionMatrix[expectedLevelKey][criterion.levelKey] =
        (ordinalConfusionMatrix[expectedLevelKey][criterion.levelKey] ?? 0) + 1;
      if (distance >= 2) {
        eliminatoryHumanReviewFindings.push({
          actualLevelKey: criterion.levelKey,
          caseId: attempt.caseId,
          criterionKey: criterion.criterionKey,
          expectedLevelKey,
          kind: 'TWO_LEVEL_ORDINAL_GAP',
          repetition: attempt.repetition,
        });
      }
    });
    familyAggregate.logicalRuns += 1;
    familyAggregates.set(family, familyAggregate);
    if ((attempt.unsureCriteria?.length ?? 0) > 0) return;
    const expectedScore = weightedDecisionScore({
      contract,
      levels: benchmarkCase.expectedCriteria,
    });
    const actualScore = weightedDecisionScore({
      contract,
      levels: attempt.output.criteria,
    });
    const guardBandRequiresSecondPass =
      input.scoreGuardRoutedRuns.has(
        `${attempt.caseId}|${attempt.repetition}`,
      ) ||
      (input.configuration.scoreGuardBandPoints !== undefined &&
        Math.abs(actualScore - contract.passingScore) <=
          input.configuration.scoreGuardBandPoints);
    if (guardBandRequiresSecondPass) return;
    const expectedPass = expectedScore >= contract.passingScore;
    const actualPass = actualScore >= contract.passingScore;
    decisionCount += 1;
    decisionMatches += expectedPass === actualPass ? 1 : 0;
    if (!attempt.output.secondPass.required) {
      certainDecisionCount += 1;
      certainDecisionMatches += expectedPass === actualPass ? 1 : 0;
    }
    falsePassCount += !expectedPass && actualPass ? 1 : 0;
    falseFailCount += expectedPass && !actualPass ? 1 : 0;
    goldPassCount += expectedPass ? 1 : 0;
    goldFailCount += expectedPass ? 0 : 1;
    familyAggregate.decisionCount += 1;
    familyAggregate.decisionMatches += expectedPass === actualPass ? 1 : 0;
    familyAggregate.falsePassCount += !expectedPass && actualPass ? 1 : 0;
    familyAggregate.falseFailCount += expectedPass && !actualPass ? 1 : 0;
    familyAggregate.goldPassCount += expectedPass ? 1 : 0;
    familyAggregate.goldFailCount += expectedPass ? 0 : 1;
    if (!expectedPass && actualPass) {
      eliminatoryHumanReviewFindings.push({
        caseId: attempt.caseId,
        kind: 'FALSE_PASS',
        repetition: attempt.repetition,
      });
    }
  });

  for (const expectedLevelKey of input.ordinalLevelKeys) {
    ordinalConfusionMatrix[expectedLevelKey] ??= {};
    for (const actualLevelKey of input.ordinalLevelKeys)
      ordinalConfusionMatrix[expectedLevelKey][actualLevelKey] ??= 0;
  }
  return {
    byFamily: serializeFamilies(familyAggregates),
    criterionAgreement:
      criterionCount === 0 ? 0 : criterionMatches / criterionCount,
    decisionAgreement:
      decisionCount === 0 ? 0 : decisionMatches / decisionCount,
    decisionAgreementExcludingSecondPass:
      certainDecisionCount === 0
        ? 0
        : certainDecisionMatches / certainDecisionCount,
    eliminatoryHumanReviewFindings,
    falseFailCount,
    falseFailRate: goldPassCount === 0 ? 0 : falseFailCount / goldPassCount,
    falsePassCount,
    falsePassRate: goldFailCount === 0 ? 0 : falsePassCount / goldFailCount,
    meanCalibrationError:
      criterionCount === 0 ? 0 : confidenceError / criterionCount,
    meanOrdinalDistance:
      criterionCount === 0 ? 0 : ordinalDistanceTotal / criterionCount,
    ordinalConfusionMatrix,
    twoLevelOrdinalGapCount: eliminatoryHumanReviewFindings.filter(
      (finding) => finding.kind === 'TWO_LEVEL_ORDINAL_GAP',
    ).length,
  };
}
