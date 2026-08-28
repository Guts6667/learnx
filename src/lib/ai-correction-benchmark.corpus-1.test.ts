/// <reference types="node" />

import type { BenchmarkAttempt } from '@/lib/ai-correction-benchmark';
import type { CorrectionOutput } from '@/lib/ai-correction-contracts';

import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  assertBenchmarkCompletionFinished,
  benchmarkAttemptSchema,
  benchmarkResumeArtifactSchema,
  findBenchmarkContract,
  prepareBenchmarkResume,
  summarizeCorrectionBenchmark,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from '@/lib/ai-correction-benchmark';
import { selectFullBlindReviewRuns } from '../../scripts/generate-ai-correction-full-blind-review';
import {
  loadCorpus,
  loadConfiguration,
  buildOutput,
  attemptIdentity,
  pendingRunMetadata,
  autonomousDigests,
  fullResumeArtifact,
  validResumeAttempt,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark corpus — part 1', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects truncated provider responses instead of repairing them', () => {
    expect(() => assertBenchmarkCompletionFinished('length')).toThrow(
      'OPENROUTER_RESPONSE_TRUNCATED',
    );
    expect(() => assertBenchmarkCompletionFinished('stop')).not.toThrow();
  });

  it('prepares a strict resume schedule without duplicating persisted cells', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase) {
      throw new Error('Expected benchmark fixtures are missing.');
    }
    const existing = validResumeAttempt({
      benchmarkCase,
      candidate,
      configuration,
      repetition: 1,
    });

    const resume = prepareBenchmarkResume({
      artifact: fullResumeArtifact({
        attempts: [existing],
        configuration,
        corpus,
      }),
      configuration,
      corpus,
    });

    expect(resume.artifact.attempts).toEqual([existing]);
    expect(resume.pendingCells).toHaveLength(
      corpus.cases.length * configuration.repetitions - 1,
    );
    expect(resume.pendingCells).not.toContainEqual({
      attemptStart: 1,
      candidateId: candidate.candidateId,
      caseId: benchmarkCase.caseId,
      repetition: 1,
    });
  });

  it('binds resume to configuration and corpus digests', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const artifact = fullResumeArtifact({ configuration, corpus });
    const boundArtifact = {
      ...artifact,
      configurationSha256: autonomousDigests.configuration,
      corpusSha256: autonomousDigests.corpus,
      runMetadata: {
        ...artifact.runMetadata,
        configurationSha256: autonomousDigests.configuration,
        corpusSha256: autonomousDigests.corpus,
      },
    };
    expect(() =>
      prepareBenchmarkResume({
        artifact: boundArtifact,
        configuration,
        configurationSha256: autonomousDigests.configuration,
        corpus,
        corpusSha256: autonomousDigests.corpus,
      }),
    ).not.toThrow();
    expect(() =>
      prepareBenchmarkResume({
        artifact: boundArtifact,
        configuration,
        configurationSha256: '9'.repeat(64),
        corpus,
        corpusSha256: autonomousDigests.corpus,
      }),
    ).toThrow('BENCHMARK_RESUME_IDENTITY_MISMATCH');
  });

  it('rejects output contract identity mismatches in resume and summary paths', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase) {
      throw new Error('Expected benchmark fixtures are missing.');
    }
    const attempt = validResumeAttempt({
      benchmarkCase,
      candidate,
      configuration,
      repetition: 1,
    });
    if (!attempt.output) {
      throw new Error('Expected benchmark output.');
    }
    const mismatchedAttempt: BenchmarkAttempt = {
      ...attempt,
      output: { ...attempt.output, contractVersion: '9.9.9' },
    };

    expect(() =>
      prepareBenchmarkResume({
        artifact: fullResumeArtifact({
          attempts: [mismatchedAttempt],
          configuration,
          corpus,
        }),
        configuration,
        corpus,
      }),
    ).toThrow('BENCHMARK_ATTEMPT_OUTPUT_CONTRACT_IDENTITY_MISMATCH');
    expect(() =>
      summarizeCorrectionBenchmark({
        attempts: [mismatchedAttempt],
        configuration,
        corpus,
        runMetadata: pendingRunMetadata({
          candidateIds: [candidate.candidateId],
          caseIds: [benchmarkCase.caseId],
        }),
      }),
    ).toThrow('BENCHMARK_ATTEMPT_OUTPUT_CONTRACT_IDENTITY_MISMATCH');
  });

  it('resumes only missing cells and preserves a terminally unusable cell', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const completed = corpus.cases
      .flatMap((benchmarkCase) =>
        [1, 2, 3].map((repetition) => ({ benchmarkCase, repetition })),
      )
      .slice(0, 25)
      .map(({ benchmarkCase, repetition }) =>
        validResumeAttempt({
          benchmarkCase,
          candidate,
          configuration,
          repetition,
        }),
      );
    const terminalCase = corpus.cases[10];
    if (!terminalCase) {
      throw new Error('Expected terminal benchmark case.');
    }
    const terminalInvalids: BenchmarkAttempt[] = [1, 2].map((attempt) => ({
      ...attemptIdentity(configuration),
      attempt,
      candidateId: candidate.candidateId,
      caseId: terminalCase.caseId,
      errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID',
      latencyMs: 1,
      modelId: candidate.modelId,
      repetition: 2,
      status: 'INVALID',
    }));

    const resume = prepareBenchmarkResume({
      artifact: fullResumeArtifact({
        attempts: [...completed, ...terminalInvalids],
        configuration,
        corpus,
      }),
      configuration,
      corpus,
    });

    expect(resume.pendingCells).toHaveLength(46);
    expect(resume.pendingCells).not.toContainEqual(
      expect.objectContaining({
        caseId: terminalCase.caseId,
        repetition: 2,
      }),
    );
  });

  it('persists protocol 3 no-evidence output and invalid raw output without crashing', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase) {
      throw new Error('Expected benchmark fixtures.');
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const rawOutput = {
      criteria: Object.fromEntries(
        contract.criteria.map((criterion) => {
          const level = [...criterion.performanceLevels].sort(
            (left, right) => left.score - right.score,
          )[0];
          if (!level) throw new Error('Expected level.');
          return [
            criterion.key,
            {
              confidence: 0.9,
              evidenceQuotes: [],
              evidenceStatus: 'NO_RELEVANT_EVIDENCE',
              feedback: 'Aucune preuve pertinente.',
              levelKey: level.key,
            },
          ];
        }),
      ),
      overallFeedback: 'Complétez la production.',
    };
    const resolved = validateBenchmarkProtocol3ModelOutputWithEvidence({
      benchmarkCase,
      canary: configuration.controlPrompt.canary,
      contract,
      output: rawOutput,
    });
    expect(() =>
      benchmarkAttemptSchema.parse({
        ...attemptIdentity(configuration),
        attempt: 1,
        candidateId: candidate.candidateId,
        caseId: benchmarkCase.caseId,
        latencyMs: 1,
        modelId: candidate.modelId,
        output: resolved.output,
        repetition: 1,
        status: 'VALID',
      }),
    ).not.toThrow();
    expect(() =>
      benchmarkAttemptSchema.parse({
        ...attemptIdentity(configuration),
        attempt: 1,
        candidateId: candidate.candidateId,
        caseId: benchmarkCase.caseId,
        errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID',
        latencyMs: 1,
        modelId: candidate.modelId,
        rawModelOutput: JSON.stringify(rawOutput),
        repetition: 1,
        status: 'INVALID',
      }),
    ).not.toThrow();
  });

  it('rejects a resume artifact with a different benchmark identity', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const artifact = {
      ...fullResumeArtifact({ configuration, corpus }),
      promptVersion: '9.9.9',
    };

    expect(() =>
      prepareBenchmarkResume({ artifact, configuration, corpus }),
    ).toThrow('BENCHMARK_RESUME_IDENTITY_MISMATCH');
  });

  it('keeps protocol 2 artifacts readable but prevents cross-protocol resume', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const legacyArtifact = {
      ...fullResumeArtifact({ configuration, corpus }),
      promptVersion: '1.6.0',
      requestProtocolVersion: '2.0.0',
    };
    expect(benchmarkResumeArtifactSchema.parse(legacyArtifact)).toMatchObject({
      promptVersion: '1.6.0',
      requestProtocolVersion: '2.0.0',
    });
    expect(() =>
      prepareBenchmarkResume({
        artifact: legacyArtifact,
        configuration,
        corpus,
      }),
    ).toThrow('BENCHMARK_RESUME_IDENTITY_MISMATCH');
  });

  it('returns an empty schedule for an already complete artifact', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate is missing.');
    }
    const attempts = corpus.cases.flatMap((benchmarkCase) =>
      Array.from({ length: configuration.repetitions }, (_, index) =>
        validResumeAttempt({
          benchmarkCase,
          candidate,
          configuration,
          repetition: index + 1,
        }),
      ),
    );

    const resume = prepareBenchmarkResume({
      artifact: fullResumeArtifact({ attempts, configuration, corpus }),
      configuration,
      corpus,
    });

    expect(resume.pendingCells).toEqual([]);
  });

  it('selects variable, injection, disagreement, second-pass and retry runs generically', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const candidate = configuration.candidates[0];
    const regular = corpus.cases.find(
      (benchmarkCase) =>
        benchmarkCase.caseId === 'benchmark-writing-successful',
    );
    const injection = corpus.cases.find(
      (benchmarkCase) =>
        benchmarkCase.caseId === 'benchmark-practice-prompt-injection',
    );
    const offTopic = corpus.cases.find(
      (benchmarkCase) => benchmarkCase.caseId === 'benchmark-writing-off-topic',
    );
    if (!candidate || !regular || !injection || !offTopic) {
      throw new Error('Expected benchmark fixtures are missing.');
    }
    const regularOutput = buildOutput({
      benchmarkCase: regular,
      quote: regular.responseText.slice(0, 12),
    });
    const changedOutput: CorrectionOutput = {
      ...regularOutput,
      criteria: regularOutput.criteria.map((criterion, index) =>
        index === 0 ? { ...criterion, levelKey: 'insufficient' } : criterion,
      ),
    };
    const secondPassOutput: CorrectionOutput = {
      ...regularOutput,
      secondPass: { reasons: ['Signal déterministe de test.'], required: true },
    };
    const falsePassOutput: CorrectionOutput = {
      ...buildOutput({
        benchmarkCase: offTopic,
        quote: offTopic.responseText.slice(0, 12),
      }),
      criteria: offTopic.expectedCriteria.map((criterion) => ({
        confidence: 1,
        criterionKey: criterion.criterionKey,
        evidenceQuotes: [offTopic.responseText.slice(0, 12)],
        feedback: 'Retour de test.',
        levelKey: 'mastered',
      })),
    };
    const identity = attemptIdentity(configuration);
    const makeAttempt = (input: {
      attempt?: number;
      benchmarkCase: typeof regular;
      output?: CorrectionOutput;
      repetition: number;
      status?: 'VALID' | 'INVALID';
    }): BenchmarkAttempt => {
      const shared = {
        attempt: input.attempt ?? 1,
        candidateId: candidate.candidateId,
        caseId: input.benchmarkCase.caseId,
        latencyMs: 1,
        modelId: candidate.modelId,
        repetition: input.repetition,
        ...identity,
      };
      return input.status === 'INVALID'
        ? {
            ...shared,
            errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID',
            status: 'INVALID',
          }
        : { ...shared, output: input.output, status: 'VALID' };
    };
    const attempts: BenchmarkAttempt[] = [
      makeAttempt({
        benchmarkCase: regular,
        output: regularOutput,
        repetition: 1,
      }),
      makeAttempt({
        benchmarkCase: regular,
        output: changedOutput,
        repetition: 2,
      }),
      makeAttempt({
        benchmarkCase: regular,
        output: secondPassOutput,
        repetition: 3,
      }),
      makeAttempt({
        benchmarkCase: offTopic,
        output: falsePassOutput,
        repetition: 1,
      }),
      makeAttempt({
        benchmarkCase: injection,
        repetition: 1,
        status: 'INVALID',
      }),
      makeAttempt({
        attempt: 2,
        benchmarkCase: injection,
        output: buildOutput({
          benchmarkCase: injection,
          quote: injection.responseText.slice(0, 12),
        }),
        repetition: 1,
      }),
    ];

    const selected = selectFullBlindReviewRuns({ attempts, corpus });

    expect(selected.get(`${regular.caseId}|1`)).toContain(
      'VARIABLE_CASE_ALL_FINAL_OUTPUTS',
    );
    expect(selected.get(`${regular.caseId}|2`)).toContain(
      'GOLD_DISAGREEMENT:writing',
    );
    expect(selected.get(`${regular.caseId}|3`)).toContain(
      'MODEL_SECOND_PASS_REQUIRED',
    );
    expect(selected.get(`${offTopic.caseId}|1`)).toContain(
      'FALSE_PASS_DECISION',
    );
    expect(selected.get(`${injection.caseId}|1`)).toEqual(
      new Set([
        'INJECTION_CASE_ALL_FINAL_OUTPUTS',
        'INITIAL_INVALID_WITH_RETRY',
        'PRE_REGISTERED_ONE_PER_CASE',
      ]),
    );
    expect(selected.get(`${regular.caseId}|1`)).toContain(
      'PRE_REGISTERED_ONE_PER_CASE',
    );
    expect(selected.get(`${injection.caseId}|1`)).toContain(
      'PRE_REGISTERED_ONE_PER_CASE',
    );
  });
});
