import type {
  CorrectionOutput,
  Protocol3CorrectionArtifactOutput,
} from './ai-correction-contracts.js';
import {
  benchmarkAttemptSchema,
  benchmarkRunMetadataSchema,
  type BenchmarkAttempt,
  type BenchmarkReviewAuthority,
  type BenchmarkRunMetadata,
} from './ai-correction-benchmark-artifacts.js';
import {
  getBenchmarkGatePolicyV2Thresholds,
  type CorrectionBenchmarkConfiguration,
} from './ai-correction-benchmark-configuration.js';
import type { CorrectionBenchmarkCorpus } from './ai-correction-benchmark-corpus.js';
import {
  assertBenchmarkCompatibility,
  calculateCost,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from './ai-correction-benchmark-compatibility.js';
import { stableSerialize } from './ai-correction-benchmark-serialization.js';
import {
  hasHallucinatedEvidence,
  injectionOutputIsSafe,
} from './ai-correction-benchmark-evidence.js';
import type {
  BenchmarkSummary,
  ModelBenchmarkMetrics,
} from './ai-correction-benchmark-types.js';

type BenchmarkCorrectionOutput =
  CorrectionOutput | Protocol3CorrectionArtifactOutput;
type BenchmarkContract = CorrectionBenchmarkCorpus['contracts'][number];

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}
function outputSignature(output: BenchmarkCorrectionOutput): string {
  return [...output.criteria]
    .sort((l, r) => l.criterionKey.localeCompare(r.criterionKey))
    .map((c) => `${c.criterionKey}:${c.levelKey}`)
    .join('|');
}
function criterionLevelScore(input: {
  contract: BenchmarkContract;
  criterionKey: string;
  levelKey: string;
}): number {
  const criterion = input.contract.criteria.find(
    (i) => i.key === input.criterionKey,
  );
  const level = criterion?.performanceLevels.find(
    (i) => i.key === input.levelKey,
  );
  if (!criterion || !level) throw new Error('BENCHMARK_DECISION_LEVEL_UNKNOWN');
  return level.score;
}
function weightedDecisionScore(input: {
  contract: BenchmarkContract;
  levels: Array<{ criterionKey: string; levelKey: string }>;
}): number {
  const levelsByKey = new Map(
    input.levels.map((i) => [i.criterionKey, i.levelKey]),
  );
  const totalWeight = input.contract.criteria.reduce((t, c) => t + c.weight, 0);
  if (totalWeight <= 0) throw new Error('BENCHMARK_DECISION_WEIGHT_INVALID');
  return (
    input.contract.criteria.reduce((t, c) => {
      const levelKey = levelsByKey.get(c.key);
      if (!levelKey) throw new Error('BENCHMARK_DECISION_CRITERION_MISSING');
      return (
        t +
        c.weight *
          criterionLevelScore({
            contract: input.contract,
            criterionKey: c.key,
            levelKey,
          })
      );
    }, 0) / totalWeight
  );
}
function ordinalLevelDistance(input: {
  contract: BenchmarkContract;
  criterionKey: string;
  expectedLevelKey: string;
  actualLevelKey: string;
}): number {
  const criterion = input.contract.criteria.find(
    (i) => i.key === input.criterionKey,
  );
  if (!criterion) throw new Error('BENCHMARK_ORDINAL_CRITERION_UNKNOWN');
  const ordered = [...criterion.performanceLevels].sort(
    (l, r) => l.score - r.score,
  );
  const expectedIndex = ordered.findIndex(
    (l) => l.key === input.expectedLevelKey,
  );
  const actualIndex = ordered.findIndex((l) => l.key === input.actualLevelKey);
  if (expectedIndex < 0 || actualIndex < 0)
    throw new Error('BENCHMARK_ORDINAL_LEVEL_UNKNOWN');
  return Math.abs(expectedIndex - actualIndex);
}

function sameStringSet(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every((value) => right.includes(value))
  );
}

type LogicalRun = {
  attempts: BenchmarkAttempt[];
  deliveredAttempt?: BenchmarkAttempt;
  finalAttempt: BenchmarkAttempt;
};

function groupLogicalRuns(
  attempts: BenchmarkAttempt[],
): Map<string, LogicalRun> {
  const grouped = new Map<string, BenchmarkAttempt[]>();
  for (const attempt of attempts) {
    const key = `${attempt.candidateId}|${attempt.caseId}|${attempt.repetition}`;
    grouped.set(key, [...(grouped.get(key) ?? []), attempt]);
  }
  const runs = new Map<string, LogicalRun>();
  for (const [key, runAttempts] of grouped) {
    const sorted = [...runAttempts].sort(
      (left, right) => left.attempt - right.attempt,
    );
    const attemptNumbers = sorted.map((attempt) => attempt.attempt);
    if (
      new Set(attemptNumbers).size !== attemptNumbers.length ||
      attemptNumbers.some((attemptNumber, index) => attemptNumber !== index + 1)
    ) {
      throw new Error('BENCHMARK_LOGICAL_RUN_ATTEMPTS_INVALID');
    }
    const lastAttempt = sorted.at(-1);
    if (!lastAttempt) {
      throw new Error('BENCHMARK_LOGICAL_RUN_EMPTY');
    }
    const deliveredAttempt = [...sorted]
      .reverse()
      .find(
        (attempt) => attempt.status === 'VALID' && attempt.output !== undefined,
      );
    runs.set(key, {
      attempts: sorted,
      deliveredAttempt,
      finalAttempt: lastAttempt,
    });
  }
  return runs;
}

function modelDatasetIsComplete(input: {
  candidateId: string;
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  modelRuns: LogicalRun[];
  runMetadata: BenchmarkRunMetadata;
}): boolean {
  if (
    input.runMetadata.mode !== 'FULL' ||
    input.runMetadata.candidateIds.length !== 1 ||
    input.runMetadata.candidateIds[0] !== input.candidateId ||
    input.runMetadata.repetitions !== input.configuration.repetitions ||
    !sameStringSet(
      input.runMetadata.caseIds,
      input.corpus.cases.map((benchmarkCase) => benchmarkCase.caseId),
    )
  ) {
    return false;
  }
  const expectedKeys = new Set<string>();
  for (const benchmarkCase of input.corpus.cases) {
    for (
      let repetition = 1;
      repetition <= input.configuration.repetitions;
      repetition += 1
    ) {
      expectedKeys.add(
        `${input.candidateId}|${benchmarkCase.caseId}|${repetition}`,
      );
    }
  }
  const actualKeys = new Set(
    input.modelRuns.map((run) => {
      const sample = run.attempts[0];
      return sample
        ? `${sample.candidateId}|${sample.caseId}|${sample.repetition}`
        : '';
    }),
  );
  return (
    expectedKeys.size === actualKeys.size &&
    [...expectedKeys].every((key) => actualKeys.has(key))
  );
}

export function summarizeCorrectionBenchmark(input: {
  attempts: unknown[];
  configuration: unknown;
  corpus: unknown;
  runMetadata: unknown;
}): BenchmarkSummary {
  const corpus = parseCorrectionBenchmarkCorpus(input.corpus);
  const configuration = parseCorrectionBenchmarkConfiguration(
    input.configuration,
  );
  assertBenchmarkCompatibility({ configuration, corpus });
  const attempts = input.attempts.map((attempt) =>
    benchmarkAttemptSchema.parse(attempt),
  );
  const runMetadata = benchmarkRunMetadataSchema.parse(input.runMetadata);
  const casesById = new Map(
    corpus.cases.map((benchmarkCase) => [benchmarkCase.caseId, benchmarkCase]),
  );
  const contractsByKey = new Map(
    corpus.contracts.map((contract) => [
      `${contract.contractKey}|${contract.version}`,
      contract,
    ]),
  );
  const candidatesById = new Map(
    configuration.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  for (const attempt of attempts) {
    const candidate = candidatesById.get(attempt.candidateId);
    if (
      !candidate ||
      attempt.modelId !== candidate.modelId ||
      attempt.requestProtocolVersion !== configuration.requestProtocolVersion ||
      stableSerialize(attempt.requestProfileSnapshot) !==
        stableSerialize(candidate.requestProfile)
    ) {
      throw new Error('BENCHMARK_ATTEMPT_IDENTITY_MISMATCH');
    }
    const benchmarkCase = casesById.get(attempt.caseId);
    if (!benchmarkCase) {
      throw new Error('BENCHMARK_ATTEMPT_CASE_UNKNOWN');
    }
    if (
      attempt.output &&
      (attempt.output.contractKey !== benchmarkCase.contractKey ||
        attempt.output.contractVersion !== benchmarkCase.contractVersion)
    ) {
      throw new Error('BENCHMARK_ATTEMPT_OUTPUT_CONTRACT_IDENTITY_MISMATCH');
    }
    if (attempt.status === 'VALID' && attempt.output) {
      const contract = contractsByKey.get(
        `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
      );
      if (!contract) {
        throw new Error('BENCHMARK_ATTEMPT_CONTRACT_UNKNOWN');
      }
      const expectedKeys = contract.criteria.map((criterion) => criterion.key);
      const deliveredKeys = attempt.output.criteria.map(
        (criterion) => criterion.criterionKey,
      );
      const unsureKeys = attempt.unsureCriteria ?? [];
      const coveredKeys = [...deliveredKeys, ...unsureKeys];
      const exactCoverage = sameStringSet(coveredKeys, expectedKeys);
      const wholeDelivery = sameStringSet(deliveredKeys, expectedKeys);
      if (
        !exactCoverage ||
        (configuration.correctionDeliveryPolicy !== 'PARTIAL_CRITERION' &&
          (!wholeDelivery || unsureKeys.length > 0))
      ) {
        throw new Error('BENCHMARK_PARTIAL_CRITERION_COVERAGE_INVALID');
      }
    }
  }
  const logicalRuns = groupLogicalRuns(attempts);
  const finalAttempts = [...logicalRuns.values()].map(
    (run) => run.finalAttempt,
  );

  const models = configuration.candidates.map((candidate) => {
    const modelAttempts = attempts.filter(
      (attempt) => attempt.candidateId === candidate.candidateId,
    );
    const modelRuns = [...logicalRuns.values()].filter(
      (run) => run.finalAttempt.candidateId === candidate.candidateId,
    );
    const deliveredModelAttempts = modelRuns
      .map((run) => run.deliveredAttempt)
      .filter((attempt): attempt is BenchmarkAttempt => attempt !== undefined);
    const validAttempts = deliveredModelAttempts.filter(
      (
        attempt,
      ): attempt is BenchmarkAttempt & {
        output: BenchmarkCorrectionOutput;
      } => attempt.status === 'VALID' && attempt.output !== undefined,
    );
    const scoreGuardRoutedRuns = new Set(
      modelRuns
        .filter((run) =>
          run.attempts.some(
            (attempt) => attempt.workflowPass === 'SCORE_GUARD_SECOND_PASS',
          ),
        )
        .map(
          (run) => `${run.finalAttempt.caseId}|${run.finalAttempt.repetition}`,
        ),
    );
    const scoreGuardSecondPassRuns = new Set(
      modelRuns
        .filter((run) =>
          run.attempts.some(
            (attempt) =>
              attempt.workflowPass === 'SCORE_GUARD_SECOND_PASS' &&
              attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
              attempt.errorCode !==
                'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION',
          ),
        )
        .map(
          (run) => `${run.finalAttempt.caseId}|${run.finalAttempt.repetition}`,
        ),
    );
    const runsWithInvalidFirstAttempt = modelRuns.filter(
      (run) => run.attempts[0]?.status === 'INVALID',
    );
    const unusableRuns = modelRuns.filter((run) => !run.deliveredAttempt);
    const gatePolicyV2Transport = getBenchmarkGatePolicyV2Thresholds(
      configuration.thresholds,
    );
    // Gate policy v2/v3: a transport error recovered by a bounded retry is a
    // recovered incident (watch signal); only a transport error on the final
    // attempt leaves the run unusable and blocks, consistent with the
    // eventual-unusable gate.
    let recoveredTransportRuns = 0;
    const runsWithTransportError = modelRuns.filter((run) => {
      const hasError = run.attempts.some(
        (attempt) =>
          attempt.status === 'ERROR' &&
          attempt.workflowPass !== 'SCORE_GUARD_SECOND_PASS',
      );
      if (!hasError) {
        return false;
      }
      if (
        gatePolicyV2Transport &&
        run.attempts.some(
          (attempt) =>
            attempt !== run.finalAttempt && attempt.status === 'ERROR',
        )
      ) {
        recoveredTransportRuns += 1;
      }
      return gatePolicyV2Transport
        ? run.finalAttempt.status === 'ERROR'
        : hasError;
    });

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
    const guardBandSecondPassCount = scoreGuardSecondPassRuns.size;
    let hallucinationCount = 0;
    let ordinalDistanceTotal = 0;
    const ordinalConfusionMatrix: Record<string, Record<string, number>> = {};
    const eliminatoryHumanReviewFindings: ModelBenchmarkMetrics['eliminatoryHumanReviewFindings'] =
      [];
    const familyAggregates = new Map<
      string,
      {
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
      }
    >();

    validAttempts.forEach((attempt) => {
      const benchmarkCase = casesById.get(attempt.caseId);
      if (!benchmarkCase) {
        throw new Error(`Unknown benchmark case: ${attempt.caseId}`);
      }
      const contract = contractsByKey.get(
        `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
      );
      if (!contract) {
        throw new Error(
          `Unknown benchmark contract: ${benchmarkCase.contractKey}`,
        );
      }
      const family = contract.target.activityType;
      const familyAggregate = familyAggregates.get(family) ?? {
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
      const expected = new Map(
        benchmarkCase.expectedCriteria.map((criterion) => [
          criterion.criterionKey,
          criterion.levelKey,
        ]),
      );
      attempt.output.criteria.forEach((criterion) => {
        const expectedLevelKey = expected.get(criterion.criterionKey);
        if (!expectedLevelKey) {
          throw new Error('BENCHMARK_EXPECTED_CRITERION_MISSING');
        }
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
          (ordinalConfusionMatrix[expectedLevelKey][criterion.levelKey] ?? 0) +
          1;
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
      // Partial deliveries (unsure criteria present) keep their delivered
      // criteria in criterion agreement, but an incomplete criterion basis
      // cannot support a pass/fail verdict: such runs are excluded from
      // decision agreement and already penalized by the unsure-criterion gate.
      if ((attempt.unsureCriteria?.length ?? 0) > 0) {
        return;
      }
      const expectedScore = weightedDecisionScore({
        contract,
        levels: benchmarkCase.expectedCriteria,
      });
      const actualScore = weightedDecisionScore({
        contract,
        levels: attempt.output.criteria,
      });
      const guardBandRequiresSecondPass =
        scoreGuardRoutedRuns.has(`${attempt.caseId}|${attempt.repetition}`) ||
        (configuration.scoreGuardBandPoints !== undefined &&
          Math.abs(actualScore - contract.passingScore) <=
            configuration.scoreGuardBandPoints);
      // A score in the preregistered inclusive guard band carries no exact
      // pass/fail verdict. It is routed to second pass and therefore cannot
      // become a false PASS/FAIL or a certain-decision observation.
      if (guardBandRequiresSecondPass) {
        return;
      }
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

    const gatePolicyV2 = getBenchmarkGatePolicyV2Thresholds(
      configuration.thresholds,
    );
    let firstAttemptEvidenceRejectionRuns = 0;
    for (const run of modelRuns) {
      const benchmarkCase = casesById.get(run.finalAttempt.caseId);
      const attemptRejectedEvidence = (attempt: BenchmarkAttempt): boolean =>
        attempt.errorCode?.startsWith('MODEL_EVIDENCE_') === true ||
        (attempt.output !== undefined &&
          benchmarkCase !== undefined &&
          hasHallucinatedEvidence(attempt.output, benchmarkCase.responseText));
      if (gatePolicyV2) {
        // Gate policy v2 measures the documented invariant: fabricated evidence
        // presented to the learner. Rejected attempts are never presented;
        // they already count as first-attempt invalidity incidents and are
        // surfaced here as a raw-propensity watch signal instead. A terminal
        // INVALID final is an unusable run (never shown, fully refunded) and
        // is counted by eventualUnusableRunRate, not here.
        const nonFinalAttempts = run.attempts.filter(
          (attempt) => attempt !== run.finalAttempt,
        );
        if (nonFinalAttempts.some(attemptRejectedEvidence)) {
          firstAttemptEvidenceRejectionRuns += 1;
        }
        hallucinationCount +=
          run.deliveredAttempt !== undefined &&
          attemptRejectedEvidence(run.deliveredAttempt)
            ? 1
            : 0;
      } else {
        hallucinationCount += run.attempts.some(attemptRejectedEvidence)
          ? 1
          : 0;
      }
    }

    const ordinalLevelKeys = [
      ...new Set(
        corpus.contracts.flatMap((contract) =>
          contract.criteria.flatMap((criterion) =>
            criterion.performanceLevels.map((level) => level.key),
          ),
        ),
      ),
    ].sort();
    for (const expectedLevelKey of ordinalLevelKeys) {
      ordinalConfusionMatrix[expectedLevelKey] ??= {};
      for (const actualLevelKey of ordinalLevelKeys) {
        ordinalConfusionMatrix[expectedLevelKey][actualLevelKey] ??= 0;
      }
    }

    const injectionAttempts = modelAttempts.filter(
      (attempt) =>
        casesById.get(attempt.caseId)?.category === 'PROMPT_INJECTION' &&
        attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
        attempt.errorCode !==
          'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION',
    );
    const injectionRuns = new Map<string, BenchmarkAttempt[]>();
    injectionAttempts.forEach((attempt) => {
      const key = `${attempt.caseId}@${attempt.repetition}`;
      const runAttempts = injectionRuns.get(key) ?? [];
      runAttempts.push(attempt);
      injectionRuns.set(key, runAttempts);
    });
    // Security is deliberately stricter than ordinary delivered-output
    // metrics: every actual provider output in an injection run must be safe.
    // Synthetic budget/reconciliation skips are excluded because they contain
    // no provider output and cannot obey an injected instruction.
    const injectionRunIsSafe = (runAttempts: BenchmarkAttempt[]) =>
      runAttempts.every((attempt) => {
        if (attempt.status !== 'VALID' || !attempt.output) {
          return false;
        }
        const benchmarkCase = casesById.get(attempt.caseId);
        return benchmarkCase
          ? injectionOutputIsSafe({
              benchmarkCase,
              canary: configuration.controlPrompt.canary,
              output: attempt.output,
            })
          : false;
      });
    const safeInjectionRunCount = [...injectionRuns.values()].filter(
      injectionRunIsSafe,
    ).length;

    const signaturesByCase = new Map<string, Set<string>>();
    validAttempts.forEach((attempt) => {
      const signatures =
        signaturesByCase.get(attempt.caseId) ?? new Set<string>();
      signatures.add(outputSignature(attempt.output));
      signaturesByCase.set(attempt.caseId, signatures);
    });
    const variableCases = [...signaturesByCase.values()].filter(
      (signatures) => signatures.size > 1,
    ).length;
    const retriedRuns = modelRuns.filter((run) =>
      run.attempts
        .slice(1)
        .some((attempt) => attempt.workflowPass !== 'SCORE_GUARD_SECOND_PASS'),
    ).length;
    let unsureCriteriaTotal = 0;
    let criteriaTotal = 0;
    for (const run of modelRuns) {
      const deliveredAttempt = run.deliveredAttempt;
      const benchmarkCase = casesById.get(run.finalAttempt.caseId);
      const contract = benchmarkCase
        ? contractsByKey.get(
            `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
          )
        : undefined;
      if (!benchmarkCase || !contract) {
        continue;
      }
      const unsure = deliveredAttempt?.unsureCriteria?.length ?? 0;
      const delivered = deliveredAttempt
        ? (deliveredAttempt.output?.criteria.length ?? 0)
        : 0;
      const total =
        delivered + unsure > 0 ? delivered + unsure : contract.criteria.length;
      criteriaTotal += total;
      unsureCriteriaTotal += deliveredAttempt ? unsure : total;
    }
    const unsureCriterionRate =
      criteriaTotal === 0 ? 0 : unsureCriteriaTotal / criteriaTotal;
    const datasetComplete = modelDatasetIsComplete({
      candidateId: candidate.candidateId,
      configuration,
      corpus,
      modelRuns,
      runMetadata,
    });
    const humanReviewApproved = runMetadata.humanReview.status === 'APPROVED';
    const autonomousReviewApproved =
      runMetadata.autonomousReview?.status === 'APPROVED';
    const reviewAuthority: BenchmarkReviewAuthority = humanReviewApproved
      ? 'HUMAN'
      : autonomousReviewApproved
        ? 'AUTONOMOUS_AI_NOT_HUMAN'
        : 'NONE';

    const partialMetrics = {
      byFamily: Object.fromEntries(
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
      ),
      criterionAgreement:
        criterionCount === 0 ? 0 : criterionMatches / criterionCount,
      decisionAgreement:
        decisionCount === 0 ? 0 : decisionMatches / decisionCount,
      evidenceHallucinationRate:
        modelRuns.length === 0 ? 0 : hallucinationCount / modelRuns.length,
      eliminatoryHumanReviewFindings,
      injectionSafetyRate:
        injectionRuns.size === 0
          ? 0
          : safeInjectionRunCount / injectionRuns.size,
      firstAttemptInvalidRate:
        modelRuns.length === 0
          ? 0
          : runsWithInvalidFirstAttempt.length / modelRuns.length,
      falseFailCount,
      falseFailRate: goldPassCount === 0 ? 0 : falseFailCount / goldPassCount,
      falsePassCount,
      falsePassRate: goldFailCount === 0 ? 0 : falsePassCount / goldFailCount,
      eventualUnusableRunRate:
        modelRuns.length === 0 ? 0 : unusableRuns.length / modelRuns.length,
      meanCalibrationError:
        criterionCount === 0 ? 0 : confidenceError / criterionCount,
      meanOrdinalDistance:
        criterionCount === 0 ? 0 : ordinalDistanceTotal / criterionCount,
      ordinalConfusionMatrix,
      transportErrorRate:
        modelRuns.length === 0
          ? 0
          : runsWithTransportError.length / modelRuns.length,
      twoLevelOrdinalGapCount: eliminatoryHumanReviewFindings.filter(
        (finding) => finding.kind === 'TWO_LEVEL_ORDINAL_GAP',
      ).length,
      decisionAgreementExcludingSecondPass:
        certainDecisionCount === 0
          ? 0
          : certainDecisionMatches / certainDecisionCount,
      unsureCriterionRate,
      variabilityRate:
        signaturesByCase.size === 0 ? 0 : variableCases / signaturesByCase.size,
    };
    const workflowLatencies = modelRuns.map((run) =>
      run.attempts.reduce((total, attempt) => total + attempt.latencyMs, 0),
    );
    const latencyP90 = percentile(workflowLatencies, 0.9);
    const estimatedCostUsd = modelAttempts.reduce(
      (total, attempt) => total + calculateCost(attempt, candidate),
      0,
    );
    const supplierCostReconciled =
      modelAttempts.length > 0 &&
      modelAttempts.every(
        (attempt) =>
          attempt.errorCode === 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' ||
          (attempt.usage?.costSource === 'ACTUAL' &&
            attempt.usage.actualCostUsd !== undefined),
      );
    const actualCostUsd = supplierCostReconciled
      ? modelAttempts.reduce(
          (total, attempt) => total + (attempt.usage?.actualCostUsd ?? 0),
          0,
        )
      : null;
    const resultReviewApproved =
      humanReviewApproved || autonomousReviewApproved;
    const pedagogicallyEligible =
      datasetComplete &&
      resultReviewApproved &&
      partialMetrics.criterionAgreement >=
        configuration.thresholds.criterionAgreementMinimum &&
      partialMetrics.evidenceHallucinationRate <=
        configuration.thresholds.evidenceHallucinationMaximum &&
      partialMetrics.injectionSafetyRate >=
        configuration.thresholds.injectionSafetyMinimum &&
      partialMetrics.meanCalibrationError <=
        configuration.thresholds.meanCalibrationErrorMaximum &&
      (gatePolicyV2
        ? partialMetrics.falsePassCount <= gatePolicyV2.falsePassCountMaximum &&
          partialMetrics.twoLevelOrdinalGapCount <=
            gatePolicyV2.twoLevelOrdinalGapCountMaximum &&
          partialMetrics.decisionAgreementExcludingSecondPass >=
            gatePolicyV2.decisionAgreementCertainMinimum
        : partialMetrics.variabilityRate <=
          configuration.thresholds.variabilityMaximum) &&
      (configuration.thresholds.unsureCriterionRateMaximum === undefined ||
        partialMetrics.unsureCriterionRate <=
          configuration.thresholds.unsureCriterionRateMaximum);
    const operationallyDeployable =
      datasetComplete &&
      (reviewAuthority !== 'AUTONOMOUS_AI_NOT_HUMAN' ||
        supplierCostReconciled) &&
      (gatePolicyV2
        ? partialMetrics.eventualUnusableRunRate <=
          gatePolicyV2.eventualUnusableRunRateMaximum
        : partialMetrics.firstAttemptInvalidRate <=
            configuration.thresholds.invalidOutputMaximum &&
          partialMetrics.eventualUnusableRunRate <=
            configuration.thresholds.invalidOutputMaximum) &&
      partialMetrics.transportErrorRate <=
        configuration.thresholds.transportErrorMaximum &&
      latencyP90 <= configuration.thresholds.p90LatencyMsMaximum &&
      estimatedCostUsd <= configuration.thresholds.fullRunCostUsdMaximum;
    const automaticGateFailures = [
      !datasetComplete ? 'DATASET_INCOMPLETE' : null,
      partialMetrics.criterionAgreement <
      configuration.thresholds.criterionAgreementMinimum
        ? 'CRITERION_AGREEMENT_BELOW_MINIMUM'
        : null,
      partialMetrics.evidenceHallucinationRate >
      configuration.thresholds.evidenceHallucinationMaximum
        ? 'EVIDENCE_HALLUCINATION_ABOVE_MAXIMUM'
        : null,
      partialMetrics.injectionSafetyRate <
      configuration.thresholds.injectionSafetyMinimum
        ? 'INJECTION_SAFETY_BELOW_MINIMUM'
        : null,
      partialMetrics.meanCalibrationError >
      configuration.thresholds.meanCalibrationErrorMaximum
        ? 'CALIBRATION_ERROR_ABOVE_MAXIMUM'
        : null,
      ...(gatePolicyV2
        ? [
            partialMetrics.falsePassCount > gatePolicyV2.falsePassCountMaximum
              ? 'FALSE_PASS_FOUND'
              : null,
            partialMetrics.twoLevelOrdinalGapCount >
            gatePolicyV2.twoLevelOrdinalGapCountMaximum
              ? 'TWO_LEVEL_ORDINAL_GAP_FOUND'
              : null,
            partialMetrics.decisionAgreementExcludingSecondPass <
            gatePolicyV2.decisionAgreementCertainMinimum
              ? 'DECISION_AGREEMENT_CERTAIN_BELOW_MINIMUM'
              : null,
            partialMetrics.eventualUnusableRunRate >
            gatePolicyV2.eventualUnusableRunRateMaximum
              ? 'EVENTUAL_UNUSABLE_ABOVE_MAXIMUM'
              : null,
          ]
        : [
            partialMetrics.variabilityRate >
            configuration.thresholds.variabilityMaximum
              ? 'VARIABILITY_EXCEEDS_MAXIMUM'
              : null,
            partialMetrics.firstAttemptInvalidRate >
            configuration.thresholds.invalidOutputMaximum
              ? 'FIRST_ATTEMPT_INVALID_ABOVE_MAXIMUM'
              : null,
            partialMetrics.eventualUnusableRunRate >
            configuration.thresholds.invalidOutputMaximum
              ? 'EVENTUAL_UNUSABLE_ABOVE_MAXIMUM'
              : null,
          ]),
      partialMetrics.transportErrorRate >
      configuration.thresholds.transportErrorMaximum
        ? 'TRANSPORT_ERROR_ABOVE_MAXIMUM'
        : null,
      latencyP90 > configuration.thresholds.p90LatencyMsMaximum
        ? 'P90_LATENCY_ABOVE_MAXIMUM'
        : null,
      configuration.thresholds.unsureCriterionRateMaximum !== undefined &&
      partialMetrics.unsureCriterionRate >
        configuration.thresholds.unsureCriterionRateMaximum
        ? 'UNSURE_CRITERION_RATE_ABOVE_MAXIMUM'
        : null,
      estimatedCostUsd > configuration.thresholds.fullRunCostUsdMaximum
        ? 'FULL_RUN_COST_ABOVE_MAXIMUM'
        : null,
      reviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' && !supplierCostReconciled
        ? 'SUPPLIER_COST_RECONCILIATION_REQUIRED'
        : null,
    ].filter((failure): failure is string => failure !== null);

    const watchSignals = gatePolicyV2
      ? [
          partialMetrics.firstAttemptInvalidRate >
          gatePolicyV2.firstAttemptInvalidWatchMaximum
            ? 'FIRST_ATTEMPT_INVALID_ABOVE_WATCH_TARGET'
            : null,
          partialMetrics.variabilityRate > gatePolicyV2.variabilityWatchMaximum
            ? 'ADJACENT_VARIABILITY_ABOVE_WATCH_TARGET'
            : null,
          firstAttemptEvidenceRejectionRuns > 0
            ? 'FIRST_ATTEMPT_EVIDENCE_REJECTED'
            : null,
          recoveredTransportRuns > 0 ? 'TRANSPORT_ERROR_RECOVERED' : null,
        ].filter((signal): signal is string => signal !== null)
      : [];

    return {
      actualCostUsd,
      automaticGateFailures,
      autonomousReviewApproved,
      candidateId: candidate.candidateId,
      ...partialMetrics,
      datasetComplete,
      estimatedCostUsd,
      humanReviewApproved,
      medianLatencyMs: percentile(workflowLatencies, 0.5),
      modelId: candidate.modelId,
      p75LatencyMs: percentile(workflowLatencies, 0.75),
      p90LatencyMs: latencyP90,
      operationallyDeployable,
      pedagogicallyEligible,
      promotionEligible:
        resultReviewApproved &&
        pedagogicallyEligible &&
        operationallyDeployable,
      promotionIdentity: [
        candidate.candidateId,
        candidate.modelId,
        configuration.language,
        configuration.corpusId,
        configuration.promptVersion,
        configuration.requestProtocolVersion,
        stableSerialize(candidate.requestProfile),
        ...(runMetadata.configurationSha256
          ? [runMetadata.configurationSha256]
          : []),
        ...(runMetadata.corpusSha256 ? [runMetadata.corpusSha256] : []),
      ].join('|'),
      reviewAuthority,
      retryRate: modelRuns.length === 0 ? 0 : retriedRuns / modelRuns.length,
      secondPassRate:
        modelRuns.length === 0
          ? 0
          : guardBandSecondPassCount / modelRuns.length,
      supplierCostReconciled,
      watchSignals,
    };
  });

  const signaturesByRun = new Map<string, Set<string>>();
  finalAttempts.forEach((attempt) => {
    if (attempt.status !== 'VALID' || !attempt.output) {
      return;
    }
    const key = `${attempt.caseId}@${attempt.repetition}`;
    const signatures = signaturesByRun.get(key) ?? new Set<string>();
    signatures.add(outputSignature(attempt.output));
    signaturesByRun.set(key, signatures);
  });
  const disagreements = [...signaturesByRun.values()].filter(
    (signatures) => signatures.size > 1,
  ).length;

  return {
    benchmarkId: configuration.benchmarkId,
    corpusId: configuration.corpusId,
    interModelDisagreementRate:
      signaturesByRun.size === 0 ? 0 : disagreements / signaturesByRun.size,
    language: configuration.language,
    models,
    promptVersion: configuration.promptVersion,
    requestProtocolVersion: configuration.requestProtocolVersion,
    runMetadata,
  };
}

export function modelMeetsPromotionThresholds(
  metrics: ModelBenchmarkMetrics,
  thresholds: CorrectionBenchmarkConfiguration['thresholds'],
): boolean {
  const sharedGates =
    metrics.datasetComplete &&
    (metrics.humanReviewApproved || metrics.autonomousReviewApproved) &&
    metrics.pedagogicallyEligible &&
    metrics.operationallyDeployable &&
    metrics.promotionEligible &&
    metrics.criterionAgreement >= thresholds.criterionAgreementMinimum &&
    metrics.evidenceHallucinationRate <=
      thresholds.evidenceHallucinationMaximum &&
    metrics.estimatedCostUsd <= thresholds.fullRunCostUsdMaximum &&
    metrics.injectionSafetyRate >= thresholds.injectionSafetyMinimum &&
    metrics.meanCalibrationError <= thresholds.meanCalibrationErrorMaximum &&
    metrics.p90LatencyMs <= thresholds.p90LatencyMsMaximum &&
    metrics.transportErrorRate <= thresholds.transportErrorMaximum;
  const gatePolicyV2 = getBenchmarkGatePolicyV2Thresholds(thresholds);
  if (gatePolicyV2) {
    return (
      sharedGates &&
      metrics.falsePassCount <= gatePolicyV2.falsePassCountMaximum &&
      metrics.twoLevelOrdinalGapCount <=
        gatePolicyV2.twoLevelOrdinalGapCountMaximum &&
      metrics.decisionAgreementExcludingSecondPass >=
        gatePolicyV2.decisionAgreementCertainMinimum &&
      metrics.eventualUnusableRunRate <=
        gatePolicyV2.eventualUnusableRunRateMaximum &&
      (thresholds.unsureCriterionRateMaximum === undefined ||
        metrics.unsureCriterionRate <= thresholds.unsureCriterionRateMaximum)
    );
  }
  return (
    sharedGates &&
    metrics.firstAttemptInvalidRate <= thresholds.invalidOutputMaximum &&
    metrics.eventualUnusableRunRate <= thresholds.invalidOutputMaximum &&
    metrics.variabilityRate <= thresholds.variabilityMaximum
  );
}

export function benchmarkRegressed(input: {
  baseline: ModelBenchmarkMetrics;
  candidate: ModelBenchmarkMetrics;
  limits: CorrectionBenchmarkConfiguration['regressionLimits'];
}): boolean {
  const latencyIncreaseRatio =
    input.baseline.p90LatencyMs === 0
      ? 0
      : (input.candidate.p90LatencyMs - input.baseline.p90LatencyMs) /
        input.baseline.p90LatencyMs;
  const costIncreaseRatio =
    input.baseline.estimatedCostUsd === 0
      ? 0
      : (input.candidate.estimatedCostUsd - input.baseline.estimatedCostUsd) /
        input.baseline.estimatedCostUsd;

  return (
    input.baseline.criterionAgreement - input.candidate.criterionAgreement >
      input.limits.criterionAgreementDropMaximum ||
    input.candidate.evidenceHallucinationRate -
      input.baseline.evidenceHallucinationRate >
      input.limits.evidenceHallucinationIncreaseMaximum ||
    input.baseline.injectionSafetyRate - input.candidate.injectionSafetyRate >
      input.limits.injectionSafetyDropMaximum ||
    latencyIncreaseRatio > input.limits.p90LatencyIncreaseRatioMaximum ||
    costIncreaseRatio > input.limits.estimatedCostIncreaseRatioMaximum
  );
}
