import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  benchmarkAttemptSchema,
  benchmarkResumeArtifactSchema,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  type BenchmarkAttempt,
} from '../src/lib/ai-correction-benchmark.ts';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
  const basePath = path.resolve(path.dirname(input.configurationPath), source.extends);
  const base = JSON.parse(await readFile(basePath, 'utf8')) as Record<
    string,
    unknown
  >;
  const overlay = source as Record<string, unknown>;
  const merged = {
    ...base,
    benchmarkId: overlay.benchmarkId,
    corpusId: overlay.corpusId,
    reviewPanelCaseIds: overlay.reviewPanelCaseIds,
  };
  return parseCorrectionBenchmarkConfiguration(merged);
}

export function assertFullBlindReviewSourceIdentity(input: {
  actualAttemptsSha256: string;
  actualCorpusSha256: string;
  artifact: ReturnType<typeof benchmarkResumeArtifactSchema.parse>;
  configuration: ReturnType<typeof parseCorrectionBenchmarkConfiguration>;
  corpus: ReturnType<typeof parseCorrectionBenchmarkCorpus>;
  expectedAttemptsSha256?: string;
  expectedCorpusSha256?: string;
}): void {
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
      JSON.stringify(candidate.requestProfile);
  if (!identityMatches) {
    throw new Error('BLIND_REVIEW_SOURCE_IDENTITY_MISMATCH');
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

function finalAttempts(attempts: BenchmarkAttempt[]): Map<string, BenchmarkAttempt> {
  const finalByRun = new Map<string, BenchmarkAttempt>();
  for (const attempt of attempts) {
    const key = logicalKey(attempt);
    const current = finalByRun.get(key);
    if (!current || current.attempt < attempt.attempt) {
      finalByRun.set(key, attempt);
    }
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
  contract: ReturnType<typeof parseCorrectionBenchmarkCorpus>['contracts'][number];
  levels: Array<{ criterionKey: string; levelKey: string }>;
}): number {
  const levelsByKey = new Map(
    input.levels.map((item) => [item.criterionKey, item.levelKey]),
  );
  const totalWeight = input.contract.criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );
  return input.contract.criteria.reduce((total, criterion) => {
    const levelKey = levelsByKey.get(criterion.key);
    const level = criterion.performanceLevels.find(
      (item) => item.key === levelKey,
    );
    if (!level) {
      throw new Error('BLIND_REVIEW_LEVEL_MISSING');
    }
    return total + criterion.weight * level.score;
  }, 0) / totalWeight;
}

export function selectFullBlindReviewRuns(input: {
  attempts: BenchmarkAttempt[];
  corpus: ReturnType<typeof parseCorrectionBenchmarkCorpus>;
}): Map<string, Set<string>> {
  const finalByRun = finalAttempts(input.attempts);
  const casesById = new Map(input.corpus.cases.map((item) => [item.caseId, item]));
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
    if (benchmarkCase && contract && attempt.output) {
      const expectedPass =
        weightedScore({ contract, levels: benchmarkCase.expectedCriteria }) >=
        contract.passingScore;
      const actualPass =
        weightedScore({ contract, levels: attempt.output.criteria }) >=
        contract.passingScore;
      if (!expectedPass && actualPass) {
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
    (item) => item.status === 'INVALID',
  )) {
    select(logicalKey(attempt), 'INITIAL_INVALID_WITH_RETRY');
  }
  return selected;
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
  const artifact = benchmarkResumeArtifactSchema.parse(JSON.parse(attemptsJson));
  const configuration = await loadBlindReviewConfiguration({
    configurationJson,
    configurationPath,
  });
  const corpus = parseCorrectionBenchmarkCorpus(
    JSON.parse(corpusJson) as unknown,
  );
  assertFullBlindReviewSourceIdentity({
    actualAttemptsSha256: sha256(attemptsJson),
    actualCorpusSha256: sha256(corpusJson),
    artifact,
    configuration,
    corpus,
    expectedAttemptsSha256: optionalShaArgument('expected-attempts-sha256'),
    expectedCorpusSha256: optionalShaArgument('expected-corpus-sha256'),
  });
  const attempts = artifact.attempts.map((attempt) =>
    benchmarkAttemptSchema.parse(attempt),
  );
  const finalByRun = finalAttempts(attempts);
  const expectedRunCount = corpus.cases.length * artifact.runMetadata.repetitions;
  if (
    finalByRun.size !== expectedRunCount ||
    [...finalByRun.values()].some((attempt) => attempt.status !== 'VALID')
  ) {
    throw new Error('BLIND_REVIEW_FULL_RUN_INCOMPLETE');
  }

  const casesById = new Map(corpus.cases.map((item) => [item.caseId, item]));
  const contractsByKey = new Map(
    corpus.contracts.map((contract) => [
      `${contract.contractKey}|${contract.version}`,
      contract,
    ]),
  );
  const selected = selectFullBlindReviewRuns({ attempts, corpus });

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
    const runAttempts = attempts
      .filter((attempt) => logicalKey(attempt) === key)
      .sort((left, right) => left.attempt - right.attempt);
    return {
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
      attempts: runAttempts.map((attempt) => ({
        attempt: attempt.attempt,
        errorCode: attempt.errorCode,
        evidenceMatches: attempt.evidenceMatches,
        output: attempt.output,
        status: attempt.status,
      })),
    };
  });

  const blindArtifact = {
    reviewProtocol: {
      phase: 'BLIND_PHASE_1',
      instructions:
        'Évaluer sans consulter le mapping post-gel. Le paquet exclut modèle, fournisseur, coût, gold et catégorie.',
      schemaVersion: 1,
      sourceBinding: {
        attemptsSha256: sha256(attemptsJson),
        corpusSha256: sha256(corpusJson),
      },
    },
    cases: reviewCases,
  };
  const blindJson = `${JSON.stringify(blindArtifact, null, 2)}\n`;
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
        sha256: sha256(configurationJson),
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
    `Paquet aveugle généré : ${reviewCases.length} runs dans ${blindPath}. Mapping : ${mappingPath}.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
