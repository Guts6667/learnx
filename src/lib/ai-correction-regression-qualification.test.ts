import { readFileSync } from 'node:fs';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import {
  parseRegressionPool,
  loadRegressionSource,
} from './ai-correction-regression-pool.js';
import {
  planRegressionRun,
  deriveRegressionObservations,
  verdictKey,
  type RegressionVerdictRecord,
  type RegressionCheckerPort,
} from './ai-correction-regression-run.js';
import {
  runRegressionPool,
  runRegressionAnalysis,
} from './ai-correction-regression-run-cli.js';
import {
  computeRegressionMetrics,
  type RegressionObservation,
  type RegressionCaseScale,
} from './ai-correction-regression-metrics.js';
import { runDesignedCheckerProbe } from './ai-correction-regression-probe-cli.js';
import {
  designedCheckerIdentity,
  qualificationSha256,
  readDesignedProbeEvidence,
  type DesignedProbeEvidence,
} from './ai-correction-regression-probe-evidence.js';
import type { BenchmarkAttempt } from './ai-correction-benchmark-artifacts.js';
import {
  evaluateRegressionGates,
  parseRegressionGatePolicy,
} from './ai-correction-regression-gates.js';

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Fixture value missing');
  return value;
}

const source = path.resolve('benchmarks/ai-correction/regression');
const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'qualification-'));
  directories.push(directory);
  return directory;
}
const instructions = ['Synthetic checker fixture; never a provider request.'];
const checkerIdentity = designedCheckerIdentity({
  modelId: 'mistralai/mistral-medium-3-5',
  instructions,
  requestProfile: {
    routeProviders: ['mistral/eu'],
    maxTokens: 400,
    temperature: 0,
  },
});
const binding = {
  checker: checkerIdentity,
  qualificationRunId: 'offline-qualification',
  measurementKind: 'SYNTHETIC' as const,
  simulatesValidatedFamily: true,
};
const checker: RegressionCheckerPort = {
  verify: async ({ criteria }) => ({
    costUsd: 0.000001,
    verdicts: Object.fromEntries(
      criteria.map((criterion) => [
        criterion.criterionKey,
        'DISAGREED' as const,
      ]),
    ),
  }),
};
async function probe(directory: string, override?: RegressionCheckerPort) {
  return runDesignedCheckerProbe({
    arguments: [
      '--execute',
      '--supplier-cost-cap-usd=1',
      '--envelope-usd=1',
      '--decision-id=synthetic-offline',
    ],
    binding,
    instructions,
    checker: override ?? checker,
    apiKey: 'synthetic-no-network',
    budgetDirectory: path.join(directory, 'budget'),
    probePath: path.join(source, 'false-agree-probe.v1.json'),
    outputDirectory: path.join(directory, 'probe'),
    pricing: {
      modelId: checkerIdentity.modelId,
      promptUsdPerToken: 0.000001,
      completionUsdPerToken: 0.000001,
    },
    maxOutputTokens: 400,
    readProviderUsage: async () => 0,
  });
}

describe('bound designed-checker evidence', () => {
  it('executes the frozen twenty cases via an injected transport, reserves each call and binds every identity', async () => {
    const directory = await temporaryDirectory();
    const result = await probe(directory);
    const read = (overrides = {}) =>
      readDesignedProbeEvidence({
        evidencePath: required(result.evidencePath),
        probePath: path.join(source, 'false-agree-probe.v1.json'),
        binding: { ...binding, ...overrides },
      });
    expect(
      JSON.parse(
        await readFile(path.join(directory, 'budget/envelope.json'), 'utf8'),
      ),
    ).toMatchObject({
      keyHash: `sha256:${qualificationSha256('synthetic-no-network')}`,
    });
    expect((await read()).result.checkerFalseAgreeDesigned).toEqual({
      numerator: 0,
      denominator: 20,
      rate: 0,
    });
    expect(
      (await readFile(path.join(directory, 'budget/calls.jsonl'), 'utf8'))
        .trim()
        .split('\n'),
    ).toHaveLength(40);
    await expect(read({ qualificationRunId: 'another-run' })).rejects.toThrow(
      'IDENTITY_MISMATCH',
    );
    await expect(read({ measurementKind: 'LIVE' })).rejects.toThrow(
      'IDENTITY_MISMATCH',
    );
    for (const changed of [
      { modelId: 'different' },
      { routeProviders: ['different'] },
      { promptSha256: 'a'.repeat(64) },
      { requestProfileSha256: 'a'.repeat(64) },
    ]) {
      await expect(
        read({ checker: { ...checkerIdentity, ...changed } }),
      ).rejects.toThrow('IDENTITY_MISMATCH');
    }
    const evidence = required(result.evidence);
    await writeFile(
      required(result.evidencePath),
      JSON.stringify({ ...evidence, outcomes: evidence.outcomes.slice(1) }),
    );
    await expect(read()).rejects.toThrow('CASE_COVERAGE_MISMATCH');
    await writeFile(
      required(result.evidencePath),
      JSON.stringify({ ...evidence, probeSha256: 'a'.repeat(64) }),
    );
    await expect(read()).rejects.toThrow('IDENTITY_MISMATCH');
  });
  it('stops after unknown cost and refuses a later restart under the same envelope', async () => {
    const directory = await temporaryDirectory();
    const verify = vi.fn(async () => ({ costUsd: null, verdicts: {} }));
    await expect(probe(directory, { verify })).rejects.toThrow(
      'UNRECONCILED_COST',
    );
    expect(verify).toHaveBeenCalledTimes(1);
    await expect(probe(directory)).rejects.toThrow('RECONCILIATION_REQUIRED');
  });
  it('rejects an overrun on the final call and rejects its recorded evidence on import', async () => {
    const directory = await temporaryDirectory();
    let calls = 0;
    await expect(
      probe(directory, {
        verify: async ({ criteria }) => ({
          costUsd: ++calls === 20 ? 2 : 0.000001,
          verdicts: { [required(criteria[0]).criterionKey]: 'DISAGREED' },
        }),
      }),
    ).rejects.toThrow('RESERVATION_EXCEEDED');
    expect(calls).toBe(20);
    await expect(
      readDesignedProbeEvidence({
        evidencePath: path.join(directory, 'probe/designed-checker-probe.json'),
        probePath: path.join(source, 'false-agree-probe.v1.json'),
        binding,
      }),
    ).rejects.toThrow('RESERVATION_EXCEEDED');
    await expect(probe(directory)).rejects.toThrow('ATOM_RESERVATION_EXCEEDED');
  });
  it('does not call either the provider or usage reader in dry-run mode', async () => {
    const directory = await temporaryDirectory();
    const verify = vi.fn();
    const readProviderUsage = vi.fn();
    const result = await runDesignedCheckerProbe({
      arguments: [],
      binding,
      instructions,
      checker: { verify },
      budgetDirectory: path.join(directory, 'budget'),
      probePath: path.join(source, 'false-agree-probe.v1.json'),
      outputDirectory: path.join(directory, 'probe'),
      pricing: {
        modelId: checkerIdentity.modelId,
        promptUsdPerToken: 0.000001,
        completionUsdPerToken: 0.000001,
      },
      maxOutputTokens: 400,
      readProviderUsage,
    });
    expect(result.evidence).toBeNull();
    expect(result.reservedBoundUsd).toBeGreaterThan(0);
    expect(verify).not.toHaveBeenCalled();
    expect(readProviderUsage).not.toHaveBeenCalled();
  });
});

const scale: RegressionCaseScale = {
  caseId: 'sample',
  criteria: [
    { criterionKey: 'math', orderedLevelKeys: ['low', 'middle', 'top'] },
    { criterionKey: 'other', orderedLevelKeys: ['low', 'middle', 'top'] },
  ],
  expectedCriteria: [
    { criterionKey: 'math', levelKey: 'top' },
    { criterionKey: 'other', levelKey: 'top' },
  ],
};
const observation: RegressionObservation = {
  caseId: 'sample',
  repetition: 1,
  criteria: [
    {
      criterionKey: 'math',
      levelKey: 'top',
      confidence: 'HIGH',
      checkerVerdict: 'AGREED',
      evidenceQuotes: ['2 + 2 = 5.'],
    },
    {
      criterionKey: 'other',
      levelKey: 'top',
      confidence: 'HIGH',
      checkerVerdict: 'AGREED',
    },
  ],
};
function metrics(
  baseline: RegressionObservation,
  mutants: RegressionObservation[] = [],
) {
  return computeRegressionMetrics({
    baselines: [baseline],
    mutants,
    scales: [scale],
  });
}

describe('versioned arithmetic endorsement and mutation semantics', () => {
  it('blocks displayed mastered false arithmetic; a correct penalty or LOW/withheld result is not endorsement', () => {
    expect(
      metrics(observation).quotedArithmeticViolationsDelivered.numerator,
    ).toBe(1);
    for (const patch of [
      { levelKey: 'low' },
      { confidence: 'LOW' as const },
      { evidenceWithdrawn: true },
    ]) {
      const changed = {
        ...observation,
        criteria: observation.criteria.map((criterion) => ({
          ...criterion,
          ...patch,
        })),
      };
      expect(
        metrics(changed).quotedArithmeticViolationsDelivered.numerator,
      ).toBe(0);
    }
    expect(metrics(observation).quotedArithmeticCoverage.delivered).toEqual({
      quotesInScope: 1,
      quotesTotal: 1,
    });
    const arithmeticPolicy = parseRegressionGatePolicy(
      JSON.parse(
        readFileSync(path.join(source, 'gate-policy.v7.json'), 'utf8'),
      ) as unknown,
    );
    arithmeticPolicy.gates = arithmeticPolicy.gates.filter(
      (gate) => gate.key === 'quoted-arithmetic-violations-delivered',
    );
    const correct = {
      ...observation,
      repetition: 2,
      criteria: observation.criteria.map((criterion) => ({
        ...criterion,
        evidenceQuotes: ['2 + 2 = 4.'],
      })),
    };
    const penalized = {
      ...observation,
      criteria: observation.criteria.map((criterion) => ({
        ...criterion,
        levelKey: 'low',
      })),
    };
    const evaluate = (candidate: RegressionObservation) =>
      evaluateRegressionGates({
        policy: arithmeticPolicy,
        metrics: computeRegressionMetrics({
          baselines: [correct, candidate],
          mutants: [],
          scales: [scale],
        }),
      });
    expect(evaluate(penalized).promotionEligible).toBe(true);
    expect(evaluate(observation).gates[0]?.status).toBe('FAIL');
  });
  it.each(['STABLE', 'WITHIN_ONE_STEP', 'UNCONSTRAINED'] as const)(
    'honors %s for non-target criteria exactly',
    (othersExpectation) => {
      const mutant = {
        ...observation,
        kind: 'FACT_INVERSION' as const,
        mutantId: 'm',
        expectation: {
          othersExpectation,
          targetCriterionKey: 'math',
          targetDirection: 'DOWN' as const,
        },
        criteria: observation.criteria.map((criterion) => ({
          ...criterion,
          levelKey: 'middle',
        })),
      };
      const drift = metrics(observation, [mutant]).unrelatedCriterionDrift;
      expect(drift.numerator).toBe(othersExpectation === 'STABLE' ? 1 : 0);
      expect(drift.denominator).toBe(
        othersExpectation === 'UNCONSTRAINED' ? 0 : 1,
      );
    },
  );
  it('retains raw false equations even when the delivered evidence has been removed', () => {
    const attempts = [
      {
        rawModelOutput: JSON.stringify({
          criteria: { math: { evidenceQuotes: ['2 + 2 = 5. 3 + 3 = 7.'] } },
        }),
        output: { criteria: [] },
      },
    ] as unknown as BenchmarkAttempt[];
    const measured = computeRegressionMetrics({
      attempts,
      baselines: [],
      mutants: [],
      scales: [],
    });
    expect(measured.quotedArithmeticViolationsAnyAttempt).toEqual({
      numerator: 1,
      denominator: 1,
      rate: 1,
    });
    expect(measured.quotedArithmeticViolationsDelivered.denominator).toBe(0);
  });
});

/** Twenty-five distinct synthetic texts supply fifty direction mutants. This proves wiring only. */
async function fixture(directory: string) {
  const originalPool = parseRegressionPool(
    JSON.parse(
      readFileSync(path.join(source, 'regression-pool.v1.json'), 'utf8'),
    ) as unknown,
  );
  const first = required(originalPool.cases[0]);
  const oldCorpus = parseCorrectionBenchmarkCorpus(
    JSON.parse(
      readFileSync(path.resolve(source, first.sourcePath), 'utf8'),
    ) as unknown,
  );
  const contract = required(
    oldCorpus.contracts.find(
      (item) => item.contractKey === first.contractRef.contractKey,
    ),
  );
  const sourceCase = required(
    oldCorpus.cases.find((item) => item.caseId === first.sourceCaseId),
  );
  const expectedCriteria = contract.criteria.map((criterion) => ({
    criterionKey: criterion.key,
    levelKey: required(
      [...criterion.performanceLevels].sort((a, b) => b.score - a.score)[0],
    ).key,
  }));
  const cases = Array.from({ length: 25 }, (_, index) => ({
    ...sourceCase,
    caseId: `synthetic-${index}`,
    expectedCriteria,
    responseText: `${index + 2} + 2 = ${index + 4}. La mesure descend de 18 à 13 heures. Le suivi reste nécessaire.`,
    goldRationale: 'Synthetic transport fixture, not pedagogical validation.',
  }));
  const legitimateResponseText =
    '40 + 2 = 42. La recommandation est expliquée.';
  const attackText = originalPool.canonicalAttackSegment;
  const injection = {
    ...sourceCase,
    caseId: 'synthetic-injection',
    category: 'PROMPT_INJECTION' as const,
    expectedCriteria,
    responseText: `${legitimateResponseText} ${attackText}`,
    injectionSecurity: {
      legitimateResponseText,
      attackText,
      allowedEvidenceQuotes: ['40 + 2 = 42.'],
      forbiddenOutputFragments: [attackText],
    },
  };
  const corpus: CorrectionBenchmarkCorpus = {
    ...oldCorpus,
    corpusId: 'synthetic-qualification',
    cases: [...cases, injection],
    contracts: [contract],
  };
  const corpusText = JSON.stringify(corpus);
  await writeFile(path.join(directory, 'corpus.json'), corpusText);
  const pool = parseRegressionPool({
    ...originalPool,
    poolId: 'synthetic-qualification',
    excluded: [],
    sources: [
      {
        ...originalPool.sources[0],
        corpusId: corpus.corpusId,
        path: 'corpus.json',
        sha256: qualificationSha256(corpusText),
      },
    ],
    cases: corpus.cases.map((item) => ({
      ...first,
      caseId: `synthetic/${item.caseId}`,
      sourceCaseId: item.caseId,
      sourcePath: 'corpus.json',
      expectedCriteria,
      contractRef: { ...first.contractRef, path: 'corpus.json' },
      ...(item.injectionSecurity
        ? {
            profile: 'PROMPT_INJECTION',
            attackSegment: attackText,
            mutationHints: [],
          }
        : {}),
      oracleKind: 'MECHANICAL',
    })),
  });
  await writeFile(path.join(directory, 'pool.json'), JSON.stringify(pool));
  const plan = planRegressionRun({
    pool,
    sources: new Map([
      ['corpus.json', loadRegressionSource(Buffer.from(corpusText))],
    ]),
  });
  for (const name of ['gate-policy.v7.json', 'false-agree-probe.v1.json'])
    await copyFile(path.join(source, name), path.join(directory, name));
  return plan;
}

it('passes the entire v7 policy through public run and offline analysis with genuine measured fixture denominators', async () => {
  // All HTTP is a typed offline usage response; model/checker transports below are local functions.
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { total_usage: 0 } }), {
          status: 200,
        }),
    ),
  );
  const directory = await temporaryDirectory();
  const plan = await fixture(directory);
  const designed = await probe(directory);
  const config = parseCorrectionBenchmarkConfiguration({
    ...(JSON.parse(
      readFileSync(
        path.resolve('benchmarks/ai-correction/benchmark.v1.json'),
        'utf8',
      ),
    ) as object),
    corpusId: plan.corpus.corpusId,
    maxRetries: 0,
    repetitions: 2,
  });
  const outcome = await runRegressionPool({
    arguments: [
      `--run-pool=${path.join(directory, 'pool.json')}`,
      '--supplier-cost-cap-usd=100',
      '--profile=full',
      '--benchmark-configuration=benchmarks/ai-correction/benchmark.v1.json',
      `--designed-checker-probe=${designed.evidencePath}`,
      '--qualification-run-id=offline-qualification',
      '--simulate-validated-family',
    ],
    measurementKind: 'SYNTHETIC',
    configuration: config,
    regressionDirectory: directory,
    providerApiKey: 'synthetic-no-network',
    identities: {
      checkerModelId: checkerIdentity.modelId,
      checkerQualificationIdentity: checkerIdentity,
      maxRetries: 0,
      primaryCandidateId: 'claude-sonnet-4-6-openrouter-anthropic',
      primaryModelId: 'anthropic/claude-sonnet-4.6',
    },
    checker: {
      verify: async ({ criteria }) => ({
        costUsd: 0.000001,
        verdicts: Object.fromEntries(
          criteria.map((criterion) => [
            criterion.criterionKey,
            'AGREED' as const,
          ]),
        ),
      }),
    },
    executeCandidate: async ({ benchmarkCase, corpus }) => {
      const unit = required(
        plan.unitsByBenchmarkCaseId.get(benchmarkCase.caseId),
      );
      const contract = required(corpus.contracts[0]);
      return {
        latencyMs: 1,
        modelSnapshot: 'SYNTHETIC',
        providerRoute: 'SYNTHETIC',
        usage: {
          actualCostUsd: 0.000001,
          costSource: 'ACTUAL',
          inputTokens: 1,
          visibleOutputTokens: 1,
          reasoningTokens: 0,
        },
        output: {
          overallFeedback: 'Synthetic test.',
          criteria: Object.fromEntries(
            contract.criteria.map((criterion) => {
              const levels = [...criterion.performanceLevels].sort(
                (a, b) => a.score - b.score,
              );
              return [
                criterion.key,
                {
                  confidence: 0.9,
                  evidenceStatus: 'FOUND',
                  evidenceQuotes: [
                    required(
                      /^[^.!?]*[.!?]/.exec(benchmarkCase.responseText),
                    )[0],
                  ],
                  feedback: 'Synthetic test.',
                  levelKey:
                    unit.expectation?.targetCriterionKey === criterion.key
                      ? required(levels[0]).key
                      : required(levels.at(-1)).key,
                },
              ];
            }),
          ),
        },
      };
    },
  });
  expect(outcome.evaluation?.policyErrors).toEqual([]);
  expect(
    outcome.evaluation?.promotionEligible,
    JSON.stringify(outcome.evaluation),
  ).toBe(true);
  expect(
    outcome.evaluation?.gates
      .filter((gate) => gate.kind === 'BLOCKING')
      .every((gate) => gate.status === 'PASS'),
  ).toBe(true);
  const analyse = () =>
    runRegressionAnalysis({
      arguments: [
        `--analyse=${outcome.resultsDirectory}`,
        `--run-pool=${path.join(directory, 'pool.json')}`,
      ],
      regressionDirectory: directory,
    });
  const { analysis } = await analyse();
  expect(analysis.evaluation.promotionEligible).toBe(true);
  const confidenceChecker: RegressionCheckerPort = {
    verify: async ({ criteria }) => ({
      costUsd: 0,
      verdicts: Object.fromEntries(
        criteria.map((criterion) => [
          criterion.criterionKey,
          'AGREED' as const,
        ]),
      ),
    }),
  };
  const baselineAttempt = required(
    analysis.attempts.find(
      (attempt) => !plan.unitsByBenchmarkCaseId.get(attempt.caseId)?.mutantId,
    ),
  );
  const capped = await deriveRegressionObservations({
    checkerIdentity,
    attempts: [baselineAttempt],
    checker: confidenceChecker,
    familyScientificallyValidated: false,
    plan,
  });
  expect(
    capped[0]?.criteria.every((criterion) => criterion.confidence !== 'HIGH'),
  ).toBe(true);
  const contradictory = structuredClone(baselineAttempt);
  required(required(contradictory.output).criteria[0]).feedback =
    'Une violation de contrainte est présente.';
  const contradicted = await deriveRegressionObservations({
    checkerIdentity,
    attempts: [contradictory],
    checker: confidenceChecker,
    familyScientificallyValidated: true,
    plan,
  });
  expect(contradicted[0]?.criteria[0]?.confidence).toBe('LOW');
  const records: RegressionVerdictRecord[] = [];
  await deriveRegressionObservations({
    checkerIdentity,
    attempts: [baselineAttempt],
    checker: confidenceChecker,
    familyScientificallyValidated: true,
    plan,
    onVerdicts: async (next) => {
      records.push(...next);
    },
  });
  const persistedVerdicts = new Map(
    records.map((record) => [verdictKey(record), record.verdict]),
  );
  const replay = (attempt: BenchmarkAttempt) =>
    deriveRegressionObservations({
      checkerIdentity,
      attempts: [attempt],
      persistedVerdicts,
      familyScientificallyValidated: true,
      plan,
    });
  expect(
    (await replay(baselineAttempt))[0]?.criteria.every(
      (criterion) => criterion.checkerVerdict === 'AGREED',
    ),
  ).toBe(true);
  const changedOutput = structuredClone(baselineAttempt);
  required(required(changedOutput.output).criteria[0]).evidenceQuotes = [
    'Different evidence',
  ];
  required(required(changedOutput.output).criteria[0]).levelKey = required(
    plan.scales[0]?.criteria[0]?.orderedLevelKeys[0],
  );
  for (const changed of [
    changedOutput,
    { ...changedOutput, repetition: baselineAttempt.repetition + 1 },
    { ...baselineAttempt, candidateId: 'different-candidate' },
  ]) {
    expect(
      (await replay(changed))[0]?.criteria.every(
        (criterion) => criterion.checkerVerdict === 'UNAVAILABLE',
      ),
    ).toBe(true);
  }
  for (const changedIdentity of [
    { ...checkerIdentity, modelId: 'different-checker' },
    { ...checkerIdentity, promptSha256: 'c'.repeat(64) },
    { ...checkerIdentity, requestProfileSha256: 'd'.repeat(64) },
    { ...checkerIdentity, routeProviders: ['another-route'] },
  ]) {
    const changed = await deriveRegressionObservations({
      attempts: [baselineAttempt],
      persistedVerdicts,
      checkerIdentity: changedIdentity,
      familyScientificallyValidated: true,
      plan,
    });
    expect(
      changed[0]?.criteria.every(
        (criterion) => criterion.checkerVerdict === 'UNAVAILABLE',
      ),
    ).toBe(true);
  }
  const changedPlan = structuredClone(plan);
  required(required(changedPlan.corpus.contracts[0]).criteria[0]).label +=
    ' edited';
  const changedRubric = await deriveRegressionObservations({
    attempts: [baselineAttempt],
    persistedVerdicts,
    checkerIdentity,
    familyScientificallyValidated: true,
    plan: changedPlan,
  });
  expect(
    changedRubric[0]?.criteria.every(
      (criterion) => criterion.checkerVerdict === 'UNAVAILABLE',
    ),
  ).toBe(true);
  const legacyVerdicts = new Map(
    records.map((record) => [
      verdictKey({ criterionKey: record.criterionKey, unitId: record.unitId }),
      record.verdict,
    ]),
  );
  const legacyChecker = { verify: vi.fn(confidenceChecker.verify) };
  const legacy = await deriveRegressionObservations({
    checkerIdentity,
    attempts: [baselineAttempt],
    persistedVerdicts: legacyVerdicts,
    checker: legacyChecker,
    familyScientificallyValidated: true,
    plan,
  });
  expect(
    legacy[0]?.criteria.every(
      (criterion) => criterion.checkerVerdict === 'UNAVAILABLE',
    ),
  ).toBe(true);
  expect(legacyChecker.verify).not.toHaveBeenCalled();

  expect(
    analysis.metrics.mutationDirectionViolations.denominator,
  ).toBeGreaterThanOrEqual(50);
  expect(analysis.metrics.checkerFalseAgreeDesigned.denominator).toBe(20);
  expect(
    analysis.metrics.quotedArithmeticViolationsDelivered.denominator,
  ).toBeGreaterThan(0);
  expect(analysis.evaluation.gates).toHaveLength(
    parseRegressionGatePolicy(
      JSON.parse(
        readFileSync(path.join(source, 'gate-policy.v7.json'), 'utf8'),
      ) as unknown,
    ).gates.length,
  );
  const evidencePath = path.join(
    outcome.resultsDirectory,
    'designed-checker-probe.json',
  );
  const evidence = JSON.parse(
    await readFile(evidencePath, 'utf8'),
  ) as DesignedProbeEvidence;
  await writeFile(
    evidencePath,
    JSON.stringify({
      ...evidence,
      outcomes: evidence.outcomes.map((entry, index) =>
        index < 5 ? { ...entry, verdict: 'AGREED' } : entry,
      ),
    }),
  );
  const failed = (await analyse()).analysis.evaluation;
  expect(failed.promotionEligible).toBe(false);
  expect(
    failed.gates.find((gate) => gate.key === 'checker-false-agree-designed')
      ?.status,
  ).toBe('FAIL');
  const summaryPath = path.join(outcome.resultsDirectory, 'summary.json');
  const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as Record<
    string,
    unknown
  >;
  await writeFile(
    summaryPath,
    JSON.stringify({ ...summary, poolSha256: 'f'.repeat(64) }),
  );
  await expect(analyse()).rejects.toThrow('POOL_MISMATCH');
  await writeFile(
    summaryPath,
    JSON.stringify({ ...summary, poolSha256: undefined }),
  );
  await expect(analyse()).rejects.toThrow('FULL_POOL_BINDING_REQUIRED');
  await writeFile(summaryPath, JSON.stringify(summary));
  // Inject each blocking defect into already measured rates. The policy must keep every promised veto.
  const policy = parseRegressionGatePolicy(
    JSON.parse(
      readFileSync(path.join(source, 'gate-policy.v7.json'), 'utf8'),
    ) as unknown,
  );
  for (const gate of policy.gates.filter(
    (entry) => entry.kind === 'BLOCKING',
  )) {
    const inputs = Object.fromEntries(
      analysis.evaluation.gates.map((entry) => [
        entry.metric,
        {
          numerator: entry.numerator,
          denominator: entry.denominator,
          rate: entry.observedRate,
        },
      ]),
    );
    const denominator =
      (required(inputs[gate.metric]).denominator as number) || 100;
    const numerator =
      gate.comparison === 'MAX_COUNT'
        ? gate.threshold + 1
        : Math.floor(gate.threshold * denominator) + 1;
    inputs[gate.metric] = {
      numerator,
      denominator,
      rate: numerator / denominator,
    };
    const evaluation = evaluateRegressionGates({
      metrics: inputs as Parameters<
        typeof evaluateRegressionGates
      >[0]['metrics'],
      policy,
    });
    expect(
      evaluation.gates.find((entry) => entry.key === gate.key)?.status,
      gate.key,
    ).toBe('FAIL');
    expect(evaluation.promotionEligible).toBe(false);
  }
}, 30000);
