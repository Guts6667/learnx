import { createHash } from 'node:crypto';

import {
  applyAutonomousReviewedResult,
  applyReviewedResult,
  assertAutonomousSupplierCostReconciled,
} from './ai-correction-benchmark-runner-reviews';
import {
  autonomousCorpusReviewMetadata,
  autonomousDigests,
  autonomousResultReviewArtifact,
  fullResumeArtifact,
  loadConfiguration,
  loadCorpus,
  pendingRunMetadata,
} from './ai-correction-benchmark.test-support';

const fileSystem = vi.hoisted(() => ({
  files: new Map<string, string>(),
  writeFile: vi.fn(),
}));
const benchmarkMocks = vi.hoisted(() => ({
  applyAutonomousReview: vi.fn(),
  applyHumanReview: vi.fn(),
  assertHumanDigest: vi.fn(),
  meetsThresholds: vi.fn(),
  summarize: vi.fn(),
}));
const blindReviewMocks = vi.hoisted(() => ({
  assertMatches: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const readFile = vi.fn((filePath: string) => {
    const value = fileSystem.files.get(filePath);
    if (value === undefined) {
      return Promise.reject(new Error(`Missing fixture: ${filePath}`));
    }
    return Promise.resolve(value);
  });
  return {
    ...actual,
    default: { ...actual, readFile, writeFile: fileSystem.writeFile },
    readFile,
    writeFile: fileSystem.writeFile,
  };
});

vi.mock('./ai-correction-benchmark', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ai-correction-benchmark')>()),
  applyBenchmarkAutonomousReview: benchmarkMocks.applyAutonomousReview,
  applyBenchmarkHumanReview: benchmarkMocks.applyHumanReview,
  assertBenchmarkHumanReviewDigest: benchmarkMocks.assertHumanDigest,
  modelMeetsPromotionThresholds: benchmarkMocks.meetsThresholds,
  summarizeCorrectionBenchmark: benchmarkMocks.summarize,
}));

vi.mock(
  '../../scripts/generate-ai-correction-full-blind-review',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../scripts/generate-ai-correction-full-blind-review')
    >()),
    assertFullBlindReviewPacketMatchesSources: blindReviewMocks.assertMatches,
  }),
);

function writtenJson(): Record<string, unknown> {
  const contents = fileSystem.writeFile.mock.calls.at(-1)?.[1];
  if (typeof contents !== 'string') {
    throw new Error('Expected a serialized reviewed summary.');
  }
  return JSON.parse(contents) as Record<string, unknown>;
}

function humanFixtures(status: 'APPROVED' | 'REJECTED' = 'APPROVED') {
  const configuration = loadConfiguration();
  const corpus = loadCorpus();
  const candidate = configuration.candidates[0];
  if (!candidate) {
    throw new Error('Expected a benchmark candidate.');
  }
  const artifact = fullResumeArtifact({ configuration, corpus });
  const attemptsRaw = JSON.stringify(artifact);
  const review = {
    attemptsSha256: createHash('sha256').update(attemptsRaw).digest('hex'),
    benchmarkId: configuration.benchmarkId,
    candidateId: candidate.candidateId,
    corpusId: corpus.corpusId,
    criticalScores: { diagnosis: 90, evidence: 90, fidelity: 90 },
    eliminatoryFindings: [],
    familyScores: { practice: 90, project: 90, reflection: 90, writing: 90 },
    language: configuration.language,
    meanScore: 90,
    promptVersion: configuration.promptVersion,
    requestProfileSnapshot: candidate.requestProfile,
    requestProtocolVersion: configuration.requestProtocolVersion,
    reviewedAt: '2026-08-28T10:00:00Z',
    reviewer: 'Review owner',
    schemaVersion: 1,
    status,
  };
  return { artifact, attemptsRaw, candidate, configuration, corpus, review };
}

function actualUsage(cost = 0.1) {
  return {
    actualCostUsd: cost,
    costSource: 'ACTUAL' as const,
    inputTokens: 10,
    reasoningTokens: 0,
    visibleOutputTokens: 5,
  };
}

describe('reviewed benchmark result runner', () => {
  beforeEach(() => {
    fileSystem.files.clear();
    fileSystem.writeFile.mockReset().mockResolvedValue(undefined);
    benchmarkMocks.applyAutonomousReview.mockReset();
    benchmarkMocks.applyHumanReview.mockReset();
    benchmarkMocks.assertHumanDigest.mockReset();
    benchmarkMocks.meetsThresholds.mockReset().mockReturnValue(true);
    benchmarkMocks.summarize.mockReset();
    blindReviewMocks.assertMatches.mockReset();
  });

  it.each(['benchmarkId', 'corpusId', 'language', 'promptVersion'] as const)(
    'refuse une identité humaine divergente sur %s',
    async (field) => {
      const fixture = humanFixtures();
      fileSystem.files.set(
        '/attempts.json',
        JSON.stringify({ ...fixture.artifact, [field]: 'mismatch' }),
      );
      fileSystem.files.set('/review.json', JSON.stringify(fixture.review));

      await expect(
        applyReviewedResult({
          attemptsPath: '/attempts.json',
          configuration: fixture.configuration,
          corpus: fixture.corpus,
          reviewPath: '/review.json',
        }),
      ).rejects.toThrow('BENCHMARK_ATTEMPTS_ARTIFACT_IDENTITY_MISMATCH');
    },
  );

  it('refuse aussi une version de protocole divergente', async () => {
    const fixture = humanFixtures();
    fileSystem.files.set(
      '/attempts.json',
      JSON.stringify({ ...fixture.artifact, requestProtocolVersion: 'other' }),
    );
    fileSystem.files.set('/review.json', JSON.stringify(fixture.review));

    await expect(
      applyReviewedResult({
        attemptsPath: '/attempts.json',
        configuration: fixture.configuration,
        corpus: fixture.corpus,
        reviewPath: '/review.json',
      }),
    ).rejects.toThrow('BENCHMARK_ATTEMPTS_ARTIFACT_IDENTITY_MISMATCH');
  });

  it.each(['APPROVED', 'REJECTED'] as const)(
    'écrit un résumé humain filtré avec une revue %s',
    async (status) => {
      const fixture = humanFixtures(status);
      fileSystem.files.set('/attempts.json', fixture.attemptsRaw);
      fileSystem.files.set('/review.json', JSON.stringify(fixture.review));
      benchmarkMocks.applyHumanReview.mockReturnValue(fixture.artifact.runMetadata);
      benchmarkMocks.summarize.mockReturnValue({
        models: [
          { candidateId: fixture.candidate.candidateId },
          { candidateId: 'other-candidate' },
        ],
      });

      await applyReviewedResult({
        attemptsPath: '/attempts.json',
        configuration: fixture.configuration,
        corpus: fixture.corpus,
        reviewPath: '/review.json',
      });

      const models = writtenJson().models as Array<Record<string, unknown>>;
      expect(models).toHaveLength(1);
      expect(models[0]?.promotionEligible).toBe(status === 'APPROVED');
      expect(benchmarkMocks.meetsThresholds).toHaveBeenCalledTimes(
        status === 'APPROVED' ? 1 : 0,
      );
    },
  );

  it('refuse un résumé qui ne contient pas le candidat revu', async () => {
    const fixture = humanFixtures();
    fileSystem.files.set('/attempts.json', fixture.attemptsRaw);
    fileSystem.files.set('/review.json', JSON.stringify(fixture.review));
    benchmarkMocks.applyHumanReview.mockReturnValue(fixture.artifact.runMetadata);
    benchmarkMocks.summarize.mockReturnValue({ models: [] });

    await expect(
      applyReviewedResult({
        attemptsPath: '/attempts.json',
        configuration: fixture.configuration,
        corpus: fixture.corpus,
        reviewPath: '/review.json',
      }),
    ).rejects.toThrow('BENCHMARK_HUMAN_REVIEW_CANDIDATE_MISSING');
  });
});

describe('autonomous supplier cost reconciliation', () => {
  type CostAttempt = Parameters<
    typeof assertAutonomousSupplierCostReconciled
  >[0]['attempts'][number];
  const validBudget = {
    actualSpentUsd: 0.1,
    hardCapUsd: 1,
    reconciliationRequired: false,
  };
  const attempt = { usage: actualUsage() } as unknown as CostAttempt;

  it('accepte les coûts réels et ignore les secondes passes explicitement sautées', () => {
    expect(() =>
      assertAutonomousSupplierCostReconciled({
        attempts: [
          attempt,
          {
            errorCode: 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET',
          } as CostAttempt,
          {
            errorCode:
              'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION',
          } as CostAttempt,
        ],
        supplierBudget: validBudget,
        supplierCostCapUsd: 1,
      }),
    ).not.toThrow();
  });

  it.each([
    ['budget absent', undefined, 1, [attempt]],
    ['cap supérieur au préenregistrement', { ...validBudget, hardCapUsd: 2 }, 1, [attempt]],
    ['cap absolu dépassé', { ...validBudget, hardCapUsd: 5 }, 5, [attempt]],
    ['réconciliation demandée', { ...validBudget, reconciliationRequired: true }, 1, [attempt]],
    ['coût estimé', validBudget, 1, [{ usage: { costSource: 'ESTIMATED' } }]],
    ['coût réel absent', validBudget, 1, [{ usage: { costSource: 'ACTUAL' } }]],
  ] as const)('refuse %s', (_label, supplierBudget, supplierCostCapUsd, attempts) => {
    expect(() =>
      assertAutonomousSupplierCostReconciled({
        attempts: attempts as unknown as Parameters<
          typeof assertAutonomousSupplierCostReconciled
        >[0]['attempts'],
        supplierBudget,
        supplierCostCapUsd,
      }),
    ).toThrow('BENCHMARK_AUTONOMOUS_SUPPLIER_COST_NOT_RECONCILED');
  });

  it.each([
    ['dépense au-dessus du cap', { ...validBudget, hardCapUsd: 0.05 }],
    ['total déclaré divergent', { ...validBudget, actualSpentUsd: 0.2 }],
  ])('refuse un %s', (_label, supplierBudget) => {
    expect(() =>
      assertAutonomousSupplierCostReconciled({
        attempts: [attempt],
        supplierBudget,
        supplierCostCapUsd: 1,
      }),
    ).toThrow('BENCHMARK_AUTONOMOUS_SUPPLIER_COST_NOT_RECONCILED');
  });
});

describe('autonomous reviewed result runner', () => {
  function fixture() {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected a benchmark candidate.');
    }
    const artifact = {
      ...fullResumeArtifact({ attempts: [], configuration, corpus }),
      configurationSha256: autonomousDigests.configuration,
      corpusSha256: autonomousDigests.corpus,
      runMetadata: {
        ...pendingRunMetadata({
          candidateIds: [candidate.candidateId],
          caseIds: corpus.cases.map((item) => item.caseId),
          mode: 'FULL',
          repetitions: configuration.repetitions,
        }),
        configurationSha256: autonomousDigests.configuration,
        corpusReview: autonomousCorpusReviewMetadata(),
        corpusReviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
        corpusSha256: autonomousDigests.corpus,
      },
      supplierBudget: {
        actualSpentUsd: 0,
        hardCapUsd: 1,
        reconciliationRequired: false,
      },
      supplierCostCapUsd: 1,
    };
    return { artifact, candidate, configuration, corpus };
  }

  it('applique une revue autonome liée et recalcule l’éligibilité', async () => {
    const current = fixture();
    const attemptsRaw = JSON.stringify(current.artifact);
    const attemptsSha256 = createHash('sha256')
      .update(attemptsRaw)
      .digest('hex');
    fileSystem.files.set('/attempts.json', attemptsRaw);
    fileSystem.files.set('/blind.json', '{}');
    fileSystem.files.set('/review.json', JSON.stringify(autonomousResultReviewArtifact()));
    blindReviewMocks.assertMatches.mockReturnValue({
      reviewProtocol: {
        sourceBinding: {
          attemptsSha256,
          configurationSha256: autonomousDigests.configuration,
          corpusSha256: autonomousDigests.corpus,
        },
      },
    });
    benchmarkMocks.applyAutonomousReview.mockReturnValue(
      current.artifact.runMetadata,
    );
    benchmarkMocks.summarize.mockReturnValue({
      models: [
        { candidateId: current.candidate.candidateId, promotionEligible: true },
        { candidateId: 'candidate-b', promotionEligible: false },
      ],
    });

    await applyAutonomousReviewedResult({
      attemptsPath: '/attempts.json',
      blindReviewPacketPath: '/blind.json',
      configuration: current.configuration,
      configurationSha256: autonomousDigests.configuration,
      corpus: current.corpus,
      corpusSha256: autonomousDigests.corpus,
      ownerAuthorizationReference: 'owner-authorization.json',
      ownerAuthorizationSha256: autonomousDigests.ownerAuthorization,
      reviewPath: '/review.json',
      supplierCostCapUsd: 1,
    });

    const models = writtenJson().models as Array<Record<string, unknown>>;
    expect(models.map((model) => model.promotionEligible)).toEqual([true, false]);
  });

  it.each([
    ['benchmarkId', 'wrong'],
    ['configurationSha256', '9'.repeat(64)],
    ['corpusId', 'wrong'],
    ['corpusSha256', '8'.repeat(64)],
    ['supplierCostCapUsd', 2],
  ] as const)('refuse une source divergente sur %s', async (field, value) => {
    const current = fixture();
    const attemptsRaw = JSON.stringify({ ...current.artifact, [field]: value });
    const attemptsSha256 = createHash('sha256')
      .update(attemptsRaw)
      .digest('hex');
    fileSystem.files.set('/attempts.json', attemptsRaw);
    fileSystem.files.set('/blind.json', '{}');
    fileSystem.files.set('/review.json', JSON.stringify(autonomousResultReviewArtifact()));
    blindReviewMocks.assertMatches.mockReturnValue({
      reviewProtocol: {
        sourceBinding: {
          attemptsSha256,
          configurationSha256: autonomousDigests.configuration,
          corpusSha256: autonomousDigests.corpus,
        },
      },
    });

    await expect(
      applyAutonomousReviewedResult({
        attemptsPath: '/attempts.json',
        blindReviewPacketPath: '/blind.json',
        configuration: current.configuration,
        configurationSha256: autonomousDigests.configuration,
        corpus: current.corpus,
        corpusSha256: autonomousDigests.corpus,
        ownerAuthorizationReference: 'owner-authorization.json',
        ownerAuthorizationSha256: autonomousDigests.ownerAuthorization,
        reviewPath: '/review.json',
        supplierCostCapUsd: 1,
      }),
    ).rejects.toThrow('BENCHMARK_AUTONOMOUS_REVIEW_SOURCE_IDENTITY_MISMATCH');
  });
});
