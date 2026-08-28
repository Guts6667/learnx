import { z } from 'zod';
import type { CorrectionBenchmarkConfiguration } from './ai-correction-benchmark-configuration.js';
import type { BenchmarkAttempt } from './ai-correction-benchmark-artifacts.js';
import {
  benchmarkAttemptSchema,
  benchmarkRunMetadataSchema,
  sha256Schema,
} from './ai-correction-benchmark-artifacts.js';
import {
  benchmarkCandidateSchema,
  exactModelIdSchema,
} from './ai-correction-benchmark-configuration.js';
import {
  stableKeySchema,
  languageTagSchema,
} from './ai-correction-benchmark-corpus.js';
import {
  assertBenchmarkCompatibility,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from './ai-correction-benchmark-compatibility.js';
import { stableSerialize } from './ai-correction-benchmark-serialization.js';

const benchmarkResumeCandidateSchema = z
  .object({
    candidateId: stableKeySchema,
    modelId: exactModelIdSchema,
    provider: z.string().trim().min(1),
    requestProfile: benchmarkCandidateSchema.shape.requestProfile,
  })
  .strict();

export const benchmarkResumeArtifactSchema = z
  .object({
    attempts: z.array(benchmarkAttemptSchema),
    benchmarkId: stableKeySchema,
    candidates: z.array(benchmarkResumeCandidateSchema).length(1),
    configurationSha256: sha256Schema.optional(),
    corpusId: stableKeySchema,
    corpusSha256: sha256Schema.optional(),
    language: languageTagSchema,
    mode: z.literal('FULL'),
    modelIds: z.array(exactModelIdSchema).length(1),
    promptVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    requestProtocolVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    runMetadata: benchmarkRunMetadataSchema,
  })
  .passthrough();

export type BenchmarkResumeArtifact = z.infer<
  typeof benchmarkResumeArtifactSchema
>;

export type BenchmarkRunCell = {
  attemptStart: number;
  candidateId: string;
  caseId: string;
  repetition: number;
};

export function prepareBenchmarkResume(input: {
  artifact: unknown;
  configuration: unknown;
  configurationSha256?: string;
  corpus: unknown;
  corpusSha256?: string;
}): {
  artifact: BenchmarkResumeArtifact;
  candidate: CorrectionBenchmarkConfiguration['candidates'][number];
  pendingCells: BenchmarkRunCell[];
} {
  const artifact = benchmarkResumeArtifactSchema.parse(input.artifact);
  if (artifact.runMetadata.autonomousReview) {
    throw new Error('BENCHMARK_RESUME_AUTONOMOUS_REVIEW_IMMUTABLE');
  }
  const configuration = parseCorrectionBenchmarkConfiguration(
    input.configuration,
  );
  const corpus = parseCorrectionBenchmarkCorpus(input.corpus);
  assertBenchmarkCompatibility({ configuration, corpus });
  const artifactCandidate = artifact.candidates[0];
  const candidate = configuration.candidates.find(
    (item) => item.candidateId === artifactCandidate?.candidateId,
  );
  const expectedCaseIds = corpus.cases.map(
    (benchmarkCase) => benchmarkCase.caseId,
  );
  const casesById = new Map(
    corpus.cases.map((benchmarkCase) => [benchmarkCase.caseId, benchmarkCase]),
  );
  if (
    !candidate ||
    !artifactCandidate ||
    artifact.benchmarkId !== configuration.benchmarkId ||
    (input.configurationSha256 !== undefined &&
      artifact.configurationSha256 !== input.configurationSha256) ||
    (input.configurationSha256 !== undefined &&
      artifact.runMetadata.configurationSha256 !== input.configurationSha256) ||
    artifact.corpusId !== corpus.corpusId ||
    (input.corpusSha256 !== undefined &&
      artifact.corpusSha256 !== input.corpusSha256) ||
    (input.corpusSha256 !== undefined &&
      artifact.runMetadata.corpusSha256 !== input.corpusSha256) ||
    artifact.language !== configuration.language ||
    artifact.promptVersion !== configuration.promptVersion ||
    artifact.requestProtocolVersion !== configuration.requestProtocolVersion ||
    artifact.modelIds[0] !== candidate.modelId ||
    artifactCandidate.modelId !== candidate.modelId ||
    artifactCandidate.provider !== candidate.provider ||
    stableSerialize(artifactCandidate.requestProfile) !==
      stableSerialize(candidate.requestProfile) ||
    artifact.runMetadata.mode !== 'FULL' ||
    artifact.runMetadata.candidateIds.length !== 1 ||
    artifact.runMetadata.candidateIds[0] !== candidate.candidateId ||
    artifact.runMetadata.repetitions !== configuration.repetitions ||
    stableSerialize(artifact.runMetadata.caseIds) !==
      stableSerialize(expectedCaseIds)
  ) {
    throw new Error('BENCHMARK_RESUME_IDENTITY_MISMATCH');
  }

  const attemptsByCell = new Map<string, BenchmarkAttempt[]>();
  for (const attempt of artifact.attempts) {
    const benchmarkCase = casesById.get(attempt.caseId);
    if (
      attempt.candidateId !== candidate.candidateId ||
      attempt.modelId !== candidate.modelId ||
      attempt.requestProtocolVersion !== configuration.requestProtocolVersion ||
      stableSerialize(attempt.requestProfileSnapshot) !==
        stableSerialize(candidate.requestProfile) ||
      !expectedCaseIds.includes(attempt.caseId) ||
      attempt.repetition > configuration.repetitions
    ) {
      throw new Error('BENCHMARK_RESUME_ATTEMPT_IDENTITY_MISMATCH');
    }
    if (
      attempt.output &&
      (attempt.output.contractKey !== benchmarkCase?.contractKey ||
        attempt.output.contractVersion !== benchmarkCase?.contractVersion)
    ) {
      throw new Error('BENCHMARK_ATTEMPT_OUTPUT_CONTRACT_IDENTITY_MISMATCH');
    }
    const key = `${attempt.caseId}|${attempt.repetition}`;
    attemptsByCell.set(key, [...(attemptsByCell.get(key) ?? []), attempt]);
  }
  for (const cellAttempts of attemptsByCell.values()) {
    const ordered = [...cellAttempts].sort(
      (left, right) => left.attempt - right.attempt,
    );
    if (
      ordered.some((attempt, index) => attempt.attempt !== index + 1) ||
      ordered.slice(0, -1).some((attempt, index) => {
        const next = ordered[index + 1];
        return (
          attempt.status === 'VALID' &&
          !(
            (attempt.workflowPass === 'PRIMARY' ||
              attempt.workflowPass === 'RETRY') &&
            next?.workflowPass === 'SCORE_GUARD_SECOND_PASS'
          )
        );
      })
    ) {
      throw new Error('BENCHMARK_RESUME_DUPLICATE_OR_INCOHERENT_ATTEMPTS');
    }
  }

  const pendingCells: BenchmarkRunCell[] = [];
  for (const benchmarkCase of corpus.cases) {
    for (
      let repetition = 1;
      repetition <= configuration.repetitions;
      repetition += 1
    ) {
      const existing = attemptsByCell.get(
        `${benchmarkCase.caseId}|${repetition}`,
      );
      const finalExisting = existing?.at(-1);
      if (
        !finalExisting ||
        (finalExisting.status !== 'VALID' &&
          finalExisting.attempt <= configuration.maxRetries)
      ) {
        pendingCells.push({
          attemptStart: (finalExisting?.attempt ?? 0) + 1,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          repetition,
        });
      }
    }
  }
  return { artifact, candidate, pendingCells };
}

export function buildBenchmarkOptionalRequestParameters(
  candidate: CorrectionBenchmarkConfiguration['candidates'][number],
): {
  reasoning?: { effort: 'minimal' | 'low' } | { max_tokens: number };
  temperature?: 0;
} {
  const reasoningEffort = candidate.requestProfile.reasoning.effort;
  const reasoningBudget = candidate.requestProfile.reasoning.budgetTokens;
  return {
    ...(candidate.requestProfile.temperature === null
      ? {}
      : { temperature: candidate.requestProfile.temperature }),
    ...(reasoningEffort === 'OFF'
      ? {}
      : {
          reasoning: {
            ...(reasoningBudget === null
              ? {
                  effort: reasoningEffort.toLocaleLowerCase() as
                    'minimal' | 'low',
                }
              : { max_tokens: reasoningBudget }),
          },
        }),
  };
}

export function assertBenchmarkCompletionFinished(finishReason: string): void {
  if (finishReason === 'length') {
    throw new Error('OPENROUTER_RESPONSE_TRUNCATED');
  }
}
