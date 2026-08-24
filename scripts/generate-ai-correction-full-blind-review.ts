import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod';

import {
  benchmarkAttemptSchema,
  benchmarkResumeArtifactSchema,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  serializeCorrectionBenchmarkConfiguration,
  type BenchmarkAttempt,
} from '../src/lib/ai-correction-benchmark.ts';
import {
  correctionOutputSchema,
  protocol3CorrectionArtifactOutputSchema,
} from '../src/lib/ai-correction-contracts.ts';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function correctionBenchmarkConfigurationSha256(input: {
  budgetPolicySha256?: string;
  configuration: ReturnType<typeof parseCorrectionBenchmarkConfiguration>;
  supplierCostCapUsd?: number;
}): string {
  const serializedConfiguration = serializeCorrectionBenchmarkConfiguration(
    input.configuration,
  );
  if (
    input.supplierCostCapUsd === undefined &&
    input.budgetPolicySha256 === undefined
  ) {
    return sha256(serializedConfiguration);
  }
  return sha256(
    JSON.stringify({
      artifactKind: 'AUTONOMOUS_BENCHMARK_CONFIGURATION_IDENTITY',
      ...(input.budgetPolicySha256
        ? { budgetPolicySha256: input.budgetPolicySha256 }
        : {}),
      configuration: JSON.parse(serializedConfiguration) as unknown,
      schemaVersion: 1,
      supplierCostCapUsd: input.supplierCostCapUsd,
    }),
  );
}

function requiredPathArgument(name: string): string {
  const argument = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!argument) {
    throw new Error(`BLIND_REVIEW_${name.toUpperCase()}_PATH_REQUIRED`);
  }
  return path.resolve(argument.slice(name.length + 3));
}

function optionalShaArgument(name: string): string | undefined {
  return process.argv
    .find((item) => item.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const nonEmptyStringSchema = z.string().trim().min(1);
const blindPerformanceLevelSchema = z
  .object({
    description: nonEmptyStringSchema,
    key: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    score: z.number().int().min(0).max(100),
  })
  .strict();
const blindCriterionSchema = z
  .object({
    acceptableVariants: z.array(nonEmptyStringSchema),
    commonErrors: z.array(nonEmptyStringSchema),
    expectedElements: z.array(nonEmptyStringSchema).min(1),
    key: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    objective: nonEmptyStringSchema,
    performanceLevels: z.array(blindPerformanceLevelSchema).min(2),
    weight: z.number().int().positive().max(100),
  })
  .strict();
const blindCandidateResponseSchema = z.union([
  z
    .object({
      ordinal: z.number().int().positive(),
      output: z.union([
        correctionOutputSchema,
        protocol3CorrectionArtifactOutputSchema,
      ]),
    })
    .strict(),
  z
    .object({
      ordinal: z.number().int().positive(),
      rawOutput: z.string().min(1).max(20_000),
    })
    .strict(),
]);
const blindReviewCaseSchema = z
  .object({
    candidateResponses: z.array(blindCandidateResponseSchema).min(1),
    reviewId: z.string().regex(/^review-\d{3,}$/),
    rubric: z
      .object({
        criteria: z.array(blindCriterionSchema).min(1),
        passingScore: z.number().int().min(0).max(100),
      })
      .strict(),
    submission: z
      .object({
        responseText: nonEmptyStringSchema,
        taskContext: nonEmptyStringSchema,
        taskPrompt: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((reviewCase, context) => {
    reviewCase.candidateResponses.forEach((response, index) => {
      if (response.ordinal !== index + 1) {
        context.addIssue({
          code: 'custom',
          message: 'Blind response ordinals must be neutral and contiguous.',
          path: ['candidateResponses', index, 'ordinal'],
        });
      }
    });
  });

export const autonomousBlindReviewPacketSchema = z
  .object({
    artifactKind: z.literal('AUTONOMOUS_BLIND_RESULT_REVIEW_PACKET'),
    cases: z.array(blindReviewCaseSchema).min(1),
    reviewProtocol: z
      .object({
        instructions: nonEmptyStringSchema,
        phase: z.literal('BLIND_PHASE_1'),
        schemaVersion: z.literal(1),
        sourceBinding: z
          .object({
            attemptsSha256: sha256Schema,
            configurationSha256: sha256Schema,
            corpusSha256: sha256Schema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type AutonomousBlindReviewPacket = z.infer<
  typeof autonomousBlindReviewPacketSchema
>;

export async function loadBlindReviewConfiguration(input: {
  configurationJson: string;
  configurationPath: string;
}) {
  const source = JSON.parse(input.configurationJson) as unknown;
  if (
    typeof source !== 'object' ||
    source === null ||
    !('extends' in source) ||
    typeof source.extends !== 'string'
  ) {
    return parseCorrectionBenchmarkConfiguration(source);
  }
  const basePath = path.resolve(
    path.dirname(input.configurationPath),
    source.extends,
  );
  const base = JSON.parse(await readFile(basePath, 'utf8')) as Record<
    string,
    unknown
  >;
  const overlay = source as Record<string, unknown>;
  const merged = {
    ...base,
    ...('activityTypeScope' in overlay
      ? { activityTypeScope: overlay.activityTypeScope }
      : {}),
    benchmarkId: overlay.benchmarkId,
    corpusId: overlay.corpusId,
    ...('maxRetries' in overlay ? { maxRetries: overlay.maxRetries } : {}),
    reviewPanelCaseIds: overlay.reviewPanelCaseIds,
    ...('scoreGuardBandPoints' in overlay
      ? { scoreGuardBandPoints: overlay.scoreGuardBandPoints }
      : {}),
    ...('thresholds' in overlay &&
    overlay.thresholds !== null &&
    typeof overlay.thresholds === 'object'
      ? {
          thresholds: {
            ...(base.thresholds as Record<string, unknown>),
            ...(overlay.thresholds as Record<string, unknown>),
          },
        }
      : {}),
  };
  return parseCorrectionBenchmarkConfiguration(merged);
}

export function assertFullBlindReviewSourceIdentity(input: {
  actualAttemptsSha256: string;
  actualConfigurationSha256?: string;
  actualCorpusSha256: string;
  artifact: ReturnType<typeof benchmarkResumeArtifactSchema.parse>;
  configuration: ReturnType<typeof parseCorrectionBenchmarkConfiguration>;
  corpus: ReturnType<typeof parseCorrectionBenchmarkCorpus>;
  expectedAttemptsSha256?: string;
  expectedConfigurationSha256?: string;
  expectedCorpusSha256?: string;
}): void {
  const autonomous =
    input.artifact.runMetadata.corpusReviewAuthority ===
    'AUTONOMOUS_AI_NOT_HUMAN';
  const candidate = input.configuration.candidates.find(
    (item) => item.candidateId === input.artifact.runMetadata.candidateIds[0],
  );
  const artifactCandidate = input.artifact.candidates[0];
  const identityMatches =
    input.artifact.benchmarkId === input.configuration.benchmarkId &&
    input.artifact.corpusId === input.configuration.corpusId &&
    input.artifact.corpusId === input.corpus.corpusId &&
    input.artifact.language === input.configuration.language &&
    input.artifact.language === input.corpus.language &&
    input.artifact.promptVersion === input.configuration.promptVersion &&
    input.artifact.requestProtocolVersion ===
      input.configuration.requestProtocolVersion &&
    input.artifact.runMetadata.mode === 'FULL' &&
    input.artifact.runMetadata.candidateIds.length === 1 &&
    candidate !== undefined &&
    artifactCandidate?.candidateId === candidate.candidateId &&
    artifactCandidate.modelId === candidate.modelId &&
    JSON.stringify(artifactCandidate.requestProfile) ===
      JSON.stringify(candidate.requestProfile) &&
    (input.actualConfigurationSha256 === undefined ||
      (autonomous
        ? input.artifact.configurationSha256 ===
            input.actualConfigurationSha256 &&
          input.artifact.runMetadata.configurationSha256 ===
            input.actualConfigurationSha256
        : [
            input.artifact.configurationSha256,
            input.artifact.runMetadata.configurationSha256,
          ].every(
            (digest) =>
              digest === undefined ||
              digest === input.actualConfigurationSha256,
          ))) &&
    (autonomous
      ? input.artifact.corpusSha256 === input.actualCorpusSha256 &&
        input.artifact.runMetadata.corpusSha256 === input.actualCorpusSha256
      : [
          input.artifact.corpusSha256,
          input.artifact.runMetadata.corpusSha256,
        ].every(
          (digest) =>
            digest === undefined || digest === input.actualCorpusSha256,
        ));
  if (!identityMatches) {
    throw new Error('BLIND_REVIEW_SOURCE_IDENTITY_MISMATCH');
  }
  if (
    input.expectedConfigurationSha256 &&
    input.expectedConfigurationSha256 !== input.actualConfigurationSha256
  ) {
    throw new Error('BLIND_REVIEW_CONFIGURATION_SHA256_MISMATCH');
  }
  if (
    input.expectedAttemptsSha256 &&
    input.expectedAttemptsSha256 !== input.actualAttemptsSha256
  ) {
    throw new Error('BLIND_REVIEW_ATTEMPTS_SHA256_MISMATCH');
  }
  if (
    input.expectedCorpusSha256 &&
    input.expectedCorpusSha256 !== input.actualCorpusSha256
  ) {
    throw new Error('BLIND_REVIEW_CORPUS_SHA256_MISMATCH');
  }
}

function logicalKey(attempt: BenchmarkAttempt): string {
  return `${attempt.caseId}|${attempt.repetition}`;
}

function finalAttempts(
  attempts: BenchmarkAttempt[],
): Map<string, BenchmarkAttempt> {
  const grouped = new Map<string, BenchmarkAttempt[]>();
  for (const attempt of attempts) {
    const key = logicalKey(attempt);
    grouped.set(key, [...(grouped.get(key) ?? []), attempt]);
  }
  const finalByRun = new Map<string, BenchmarkAttempt>();
  for (const [key, runAttempts] of grouped) {
    const ordered = [...runAttempts].sort(
      (left, right) => left.attempt - right.attempt,
    );
    const delivered = [...ordered]
      .reverse()
      .find(
        (attempt) =>
          attempt.status === 'VALID' && attempt.output !== undefined,
      );
    const selected = delivered ?? ordered.at(-1);
    if (!selected) {
      continue;
    }
    finalByRun.set(key, selected);
  }
  return finalByRun;
}

function pedagogicalDecisionSignature(attempt: BenchmarkAttempt): string {
  if (!attempt.output) {
    return `NO_OUTPUT:${attempt.status}`;
  }
  return JSON.stringify({
    criteria: [...attempt.output.criteria]
      .map((criterion) => ({
        criterionKey: criterion.criterionKey,
        levelKey: criterion.levelKey,
      }))
      .sort((left, right) =>
        left.criterionKey.localeCompare(right.criterionKey),
      ),
    secondPassRequired: attempt.output.secondPass.required,
  });
}

function weightedScore(input: {
  contract: ReturnType<
    typeof parseCorrectionBenchmarkCorpus
  >['contracts'][number];
  levels: Array<{ criterionKey: string; levelKey: string }>;
}): number {
  const levelsByKey = new Map(
    input.levels.map((item) => [item.criterionKey, item.levelKey]),
  );
  const totalWeight = input.contract.criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );
  return (
    input.contract.criteria.reduce((total, criterion) => {
      const levelKey = levelsByKey.get(criterion.key);
      const level = criterion.performanceLevels.find(
        (item) => item.key === levelKey,
      );
      if (!level) {
        throw new Error('BLIND_REVIEW_LEVEL_MISSING');
      }
      return total + criterion.weight * level.score;
    }, 0) / totalWeight
  );
}

export function selectFullBlindReviewRuns(input: {
  attempts: BenchmarkAttempt[];
  corpus: ReturnType<typeof parseCorrectionBenchmarkCorpus>;
  scoreGuardBandPoints?: number;
}): Map<string, Set<string>> {
  const finalByRun = finalAttempts(input.attempts);
  const casesById = new Map(
    input.corpus.cases.map((item) => [item.caseId, item]),
  );
  const contractsByKey = new Map(
    input.corpus.contracts.map((contract) => [
      `${contract.contractKey}|${contract.version}`,
      contract,
    ]),
  );
  const selected = new Map<string, Set<string>>();
  const select = (key: string, reason: string): void => {
    selected.set(key, new Set([...(selected.get(key) ?? []), reason]));
  };
  const finalRunsByCase = new Map<string, [string, BenchmarkAttempt][]>();
  for (const entry of finalByRun.entries()) {
    const attempt = entry[1];
    finalRunsByCase.set(attempt.caseId, [
      ...(finalRunsByCase.get(attempt.caseId) ?? []),
      entry,
    ]);
  }
  const variableCaseIds = new Set(
    [...finalRunsByCase.entries()]
      .filter(
        ([, runs]) =>
          new Set(
            runs.map(([, attempt]) => pedagogicalDecisionSignature(attempt)),
          ).size > 1,
      )
      .map(([caseId]) => caseId),
  );
  for (const [caseId, runs] of finalRunsByCase) {
    const preRegisteredRun = [...runs].sort(
      (left, right) => left[1].repetition - right[1].repetition,
    )[0];
    if (!preRegisteredRun) {
      throw new Error(`BLIND_REVIEW_CASE_SAMPLE_MISSING:${caseId}`);
    }
    select(preRegisteredRun[0], 'PRE_REGISTERED_ONE_PER_CASE');
  }
  for (const [key, attempt] of finalByRun) {
    if (variableCaseIds.has(attempt.caseId)) {
      select(key, 'VARIABLE_CASE_ALL_FINAL_OUTPUTS');
    }
    if (attempt.caseId.endsWith('-prompt-injection')) {
      select(key, 'INJECTION_CASE_ALL_FINAL_OUTPUTS');
    }
    if (attempt.output?.secondPass.required) {
      select(key, 'MODEL_SECOND_PASS_REQUIRED');
    }
    const benchmarkCase = casesById.get(attempt.caseId);
    const contract = benchmarkCase
      ? contractsByKey.get(
          `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
        )
      : undefined;
    if (
      benchmarkCase &&
      contract &&
      attempt.output?.criteria.some((criterion) =>
        benchmarkCase.expectedCriteria.some(
          (expected) =>
            expected.criterionKey === criterion.criterionKey &&
            expected.levelKey !== criterion.levelKey,
        ),
      )
    ) {
      select(key, `GOLD_DISAGREEMENT:${contract.target.activityType}`);
    }
    if ((attempt.unsureCriteria?.length ?? 0) > 0) {
      select(key, 'UNSURE_CRITERIA_DELIVERY');
    }
    if (
      benchmarkCase &&
      contract &&
      attempt.output &&
      // Partial deliveries (unsure criteria) support no complete verdict:
      // score-based selections are skipped for them; they are always included
      // in the blind package via the unsure-part sampling instead.
      (attempt.unsureCriteria?.length ?? 0) === 0
    ) {
      const expectedPass =
        weightedScore({ contract, levels: benchmarkCase.expectedCriteria }) >=
        contract.passingScore;
      const actualScore = weightedScore({
        contract,
        levels: attempt.output.criteria,
      });
      const actualPass = actualScore >= contract.passingScore;
      const guardedSecondPass =
        attempt.workflowPass === 'SCORE_GUARD_SECOND_PASS' ||
        (input.scoreGuardBandPoints !== undefined &&
          Math.abs(actualScore - contract.passingScore) <=
            input.scoreGuardBandPoints);
      if (guardedSecondPass) {
        select(key, 'SCORE_GUARD_BAND_SECOND_PASS');
      } else if (!expectedPass && actualPass) {
        select(key, 'FALSE_PASS_DECISION');
      }
      const expectedByKey = new Map(
        benchmarkCase.expectedCriteria.map((criterion) => [
          criterion.criterionKey,
          criterion.levelKey,
        ]),
      );
      const hasTwoLevelGap = attempt.output.criteria.some((criterion) => {
        const rubricCriterion = contract.criteria.find(
          (item) => item.key === criterion.criterionKey,
        );
        const expectedLevelKey = expectedByKey.get(criterion.criterionKey);
        if (!rubricCriterion || !expectedLevelKey) {
          return false;
        }
        const ordered = [...rubricCriterion.performanceLevels].sort(
          (left, right) => left.score - right.score,
        );
        return (
          Math.abs(
            ordered.findIndex((level) => level.key === expectedLevelKey) -
              ordered.findIndex((level) => level.key === criterion.levelKey),
          ) >= 2
        );
      });
      if (hasTwoLevelGap) {
        select(key, 'TWO_LEVEL_ORDINAL_GAP');
      }
    }
  }
  for (const attempt of input.attempts.filter(
    (item) =>
      item.status === 'INVALID' &&
      item.workflowPass !== 'SCORE_GUARD_SECOND_PASS',
  )) {
    select(logicalKey(attempt), 'INITIAL_INVALID_WITH_RETRY');
  }
  return selected;
}

export function assertFullBlindReviewPacketIsBlind(packet: unknown): void {
  const forbiddenKeys = new Set([
    'actualCostUsd',
    'attempt',
    'automaticGateFailures',
    'automaticVerdict',
    'autonomousReview',
    'benchmarkId',
    'candidateId',
    'category',
    'cost',
    'costSource',
    'errorCode',
    'estimatedCostUsd',
    'evidenceMatches',
    'expectedCriteria',
    'expectedSecondPass',
    'gold',
    'goldRationale',
    'humanReview',
    'metrics',
    'model',
    'modelId',
    'modelIds',
    'modelSnapshot',
    'promotionEligible',
    'provider',
    'providerRequestId',
    'providerRoute',
    'reviewAuthority',
    'status',
    'summary',
    'supplierBudget',
    'unsureCriteria',
    'usage',
    'verdict',
    'workflowPass',
  ]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value === null || typeof value !== 'object') {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) {
        throw new Error(`BLIND_REVIEW_PACKET_FORBIDDEN_FIELD:${key}`);
      }
      visit(child);
    }
  };
  visit(packet);
}

export function parseAutonomousBlindReviewPacket(
  packet: unknown,
): AutonomousBlindReviewPacket {
  assertFullBlindReviewPacketIsBlind(packet);
  return autonomousBlindReviewPacketSchema.parse(packet);
}

function visibleCandidateResponses(
  attempts: BenchmarkAttempt[],
): z.infer<typeof blindCandidateResponseSchema>[] {
  const responses: z.infer<typeof blindCandidateResponseSchema>[] = [];
  for (const attempt of attempts) {
    if (attempt.status === 'INVALID' && attempt.rawModelOutput) {
      responses.push({
        ordinal: responses.length + 1,
        rawOutput: attempt.rawModelOutput.slice(0, 20_000),
      });
      continue;
    }
    if (attempt.output) {
      responses.push({
        ordinal: responses.length + 1,
        output: attempt.output,
      });
      continue;
    }
    if (attempt.rawModelOutput) {
      responses.push({
        ordinal: responses.length + 1,
        rawOutput: attempt.rawModelOutput.slice(0, 20_000),
      });
    }
  }
  return responses;
}

export function buildFullBlindReviewPacket(input: {
  artifact: ReturnType<typeof benchmarkResumeArtifactSchema.parse>;
  attemptsSha256: string;
  configuration: ReturnType<typeof parseCorrectionBenchmarkConfiguration>;
  configurationSha256: string;
  corpus: ReturnType<typeof parseCorrectionBenchmarkCorpus>;
  corpusSha256: string;
}): {
  finalByRun: Map<string, BenchmarkAttempt>;
  packet: AutonomousBlindReviewPacket;
  selected: Map<string, Set<string>>;
  selectedKeys: string[];
} {
  assertFullBlindReviewSourceIdentity({
    actualAttemptsSha256: input.attemptsSha256,
    actualConfigurationSha256: input.configurationSha256,
    actualCorpusSha256: input.corpusSha256,
    artifact: input.artifact,
    configuration: input.configuration,
    corpus: input.corpus,
  });
  const attempts = input.artifact.attempts.map((attempt) =>
    benchmarkAttemptSchema.parse(attempt),
  );
  const finalByRun = finalAttempts(attempts);
  const expectedKeys = new Set(
    input.corpus.cases.flatMap((benchmarkCase) =>
      Array.from(
        { length: input.artifact.runMetadata.repetitions },
        (_, index) => `${benchmarkCase.caseId}|${index + 1}`,
      ),
    ),
  );
  if (
    finalByRun.size !== expectedKeys.size ||
    [...expectedKeys].some((key) => !finalByRun.has(key)) ||
    [...finalByRun.values()].some((attempt) => attempt.status !== 'VALID')
  ) {
    throw new Error('BLIND_REVIEW_FULL_RUN_INCOMPLETE');
  }
  const casesById = new Map(
    input.corpus.cases.map((item) => [item.caseId, item]),
  );
  const contractsByKey = new Map(
    input.corpus.contracts.map((contract) => [
      `${contract.contractKey}|${contract.version}`,
      contract,
    ]),
  );
  const selected = selectFullBlindReviewRuns({
    attempts,
    corpus: input.corpus,
    scoreGuardBandPoints: input.configuration.scoreGuardBandPoints,
  });
  const selectedKeys = [...selected.keys()].sort();
  const reviewCases = selectedKeys.map((key, index) => {
    const finalAttempt = finalByRun.get(key);
    if (!finalAttempt) {
      throw new Error('BLIND_REVIEW_FINAL_ATTEMPT_MISSING');
    }
    const benchmarkCase = casesById.get(finalAttempt.caseId);
    if (!benchmarkCase) {
      throw new Error('BLIND_REVIEW_CASE_MISSING');
    }
    const contract = contractsByKey.get(
      `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
    );
    if (!contract) {
      throw new Error('BLIND_REVIEW_CONTRACT_MISSING');
    }
    const candidateResponses = visibleCandidateResponses(
      attempts
        .filter((attempt) => logicalKey(attempt) === key)
        .sort((left, right) => left.attempt - right.attempt),
    );
    if (candidateResponses.length === 0) {
      throw new Error('BLIND_REVIEW_CANDIDATE_RESPONSES_MISSING');
    }
    return {
      candidateResponses,
      reviewId: `review-${String(index + 1).padStart(3, '0')}`,
      rubric: {
        criteria: contract.criteria.map((criterion) => ({
          acceptableVariants: criterion.acceptableVariants,
          commonErrors: criterion.commonErrors,
          expectedElements: criterion.expectedElements,
          key: criterion.key,
          label: criterion.label,
          objective: criterion.objective,
          performanceLevels: criterion.performanceLevels,
          weight: criterion.weight,
        })),
        passingScore: contract.passingScore,
      },
      submission: {
        responseText: benchmarkCase.responseText,
        taskContext: benchmarkCase.taskContext,
        taskPrompt: benchmarkCase.taskPrompt,
      },
    };
  });
  const packet = parseAutonomousBlindReviewPacket({
    artifactKind: 'AUTONOMOUS_BLIND_RESULT_REVIEW_PACKET',
    cases: reviewCases,
    reviewProtocol: {
      instructions:
        'Évaluer uniquement les réponses candidates ci-dessous, sans consulter le mapping post-gel. Le paquet exclut identité, fournisseur, coûts, gold, statuts techniques et verdict automatique.',
      phase: 'BLIND_PHASE_1',
      schemaVersion: 1,
      sourceBinding: {
        attemptsSha256: input.attemptsSha256,
        configurationSha256: input.configurationSha256,
        corpusSha256: input.corpusSha256,
      },
    },
  });
  return { finalByRun, packet, selected, selectedKeys };
}

export function assertFullBlindReviewPacketMatchesSources(input: {
  artifact: ReturnType<typeof benchmarkResumeArtifactSchema.parse>;
  attemptsSha256: string;
  configuration: ReturnType<typeof parseCorrectionBenchmarkConfiguration>;
  configurationSha256: string;
  corpus: ReturnType<typeof parseCorrectionBenchmarkCorpus>;
  corpusSha256: string;
  packet: unknown;
}): AutonomousBlindReviewPacket {
  const packet = parseAutonomousBlindReviewPacket(input.packet);
  const expected = buildFullBlindReviewPacket(input).packet;
  if (!isDeepStrictEqual(packet, expected)) {
    throw new Error('BLIND_REVIEW_PACKET_SOURCE_RECONSTRUCTION_MISMATCH');
  }
  return packet;
}

async function main(): Promise<void> {
  const attemptsPath = requiredPathArgument('attempts');
  const configurationPath = requiredPathArgument('configuration');
  const corpusPath = requiredPathArgument('corpus');
  if (!attemptsPath.endsWith('.attempts.json')) {
    throw new Error('BLIND_REVIEW_ATTEMPTS_PATH_INVALID');
  }
  const attemptsJson = await readFile(attemptsPath, 'utf8');
  const configurationJson = await readFile(configurationPath, 'utf8');
  const corpusJson = await readFile(corpusPath, 'utf8');
  const artifact = benchmarkResumeArtifactSchema.parse(
    JSON.parse(attemptsJson),
  );
  const configuration = await loadBlindReviewConfiguration({
    configurationJson,
    configurationPath,
  });
  const configurationSource = JSON.parse(configurationJson) as unknown;
  const supplierCostCapUsd =
    configurationSource !== null &&
    typeof configurationSource === 'object' &&
    'artifactKind' in configurationSource &&
    configurationSource.artifactKind === 'AUTONOMOUS_HOLDOUT_CONFIGURATION' &&
    'supplierCostCapUsd' in configurationSource
      ? z
          .number()
          .positive()
          .max(4)
          .parse(configurationSource.supplierCostCapUsd)
      : undefined;
  const budgetPolicySha256 =
    configurationSource !== null &&
    typeof configurationSource === 'object' &&
    'budgetPolicySha256' in configurationSource
      ? sha256Schema.parse(configurationSource.budgetPolicySha256)
      : undefined;
  const configurationDigest = correctionBenchmarkConfigurationSha256({
    budgetPolicySha256,
    configuration,
    supplierCostCapUsd,
  });
  const corpus = parseCorrectionBenchmarkCorpus(
    JSON.parse(corpusJson) as unknown,
  );
  assertFullBlindReviewSourceIdentity({
    actualAttemptsSha256: sha256(attemptsJson),
    actualConfigurationSha256: configurationDigest,
    actualCorpusSha256: sha256(corpusJson),
    artifact,
    configuration,
    corpus,
    expectedAttemptsSha256: optionalShaArgument('expected-attempts-sha256'),
    expectedConfigurationSha256: optionalShaArgument(
      'expected-configuration-sha256',
    ),
    expectedCorpusSha256: optionalShaArgument('expected-corpus-sha256'),
  });
  const attemptsDigest = sha256(attemptsJson);
  const corpusDigest = sha256(corpusJson);
  const { finalByRun, packet, selected, selectedKeys } =
    buildFullBlindReviewPacket({
      artifact,
      attemptsSha256: attemptsDigest,
      configuration,
      configurationSha256: configurationDigest,
      corpus,
      corpusSha256: corpusDigest,
    });
  const attempts = artifact.attempts.map((attempt) =>
    benchmarkAttemptSchema.parse(attempt),
  );
  const casesById = new Map(corpus.cases.map((item) => [item.caseId, item]));
  const blindJson = `${JSON.stringify(packet, null, 2)}\n`;
  const outputStem = attemptsPath.slice(0, -'.attempts.json'.length);
  const blindPath = `${outputStem}.full-blind-review.json`;
  await writeFile(blindPath, blindJson, 'utf8');

  const mapping = {
    schemaVersion: 1,
    phase: 'POST_FREEZE_MAPPING',
    blindArtifact: {
      path: path.basename(blindPath),
      sha256: sha256(blindJson),
    },
    sourceArtifact: {
      benchmarkId: artifact.benchmarkId,
      configuration: {
        path: path.basename(configurationPath),
        fileSha256: sha256(configurationJson),
        sha256: configurationDigest,
      },
      corpus: {
        path: path.basename(corpusPath),
        sha256: sha256(corpusJson),
      },
      corpusId: artifact.corpusId,
      language: artifact.language,
      path: path.basename(attemptsPath),
      promptVersion: artifact.promptVersion,
      requestProtocolVersion: artifact.requestProtocolVersion,
      sha256: sha256(attemptsJson),
    },
    selection: {
      algorithmVersion: '1.0.0',
      ordering: 'caseId|repetition lexical',
      rules: [
        'one pre-registered final output (repetition 1) for each corpus case',
        'all final outputs for every case whose criterion levels or second-pass decision vary across repetitions',
        'initial invalid attempt and its bounded retry when present',
        'all final prompt-injection outputs',
        'all final outputs whose criterion levels disagree with gold, tagged by activity type and deduplicated by logical run',
        'all false-PASS decisions and all two-level ordinal gaps as eliminatory human-review findings',
        'all final outputs requesting a second pass',
      ],
    },
    cases: selectedKeys.map((key, index) => {
      const finalAttempt = finalByRun.get(key);
      const benchmarkCase = finalAttempt
        ? casesById.get(finalAttempt.caseId)
        : undefined;
      if (!finalAttempt || !benchmarkCase) {
        throw new Error('BLIND_REVIEW_MAPPING_CASE_MISSING');
      }
      return {
        reviewId: `review-${String(index + 1).padStart(3, '0')}`,
        caseId: finalAttempt.caseId,
        repetition: finalAttempt.repetition,
        category: benchmarkCase.category,
        expectedCriteria: benchmarkCase.expectedCriteria,
        expectedSecondPass: benchmarkCase.expectedSecondPass,
        goldRationale: benchmarkCase.goldRationale,
        selectionReasons: [...(selected.get(key) ?? [])].sort(),
      };
    }),
    knownDeterministicFindings: attempts
      .filter((attempt) => attempt.status === 'INVALID')
      .map((attempt) => ({
        attempt: attempt.attempt,
        caseId: attempt.caseId,
        errorCode: attempt.errorCode,
        repetition: attempt.repetition,
        status: attempt.status,
      })),
  };
  const mappingPath = `${outputStem}.full-blind-review.mapping.json`;
  await writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
  console.log(
    `Paquet aveugle généré : ${packet.cases.length} runs dans ${blindPath}. Mapping : ${mappingPath}.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
