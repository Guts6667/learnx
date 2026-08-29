import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseCorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import { runBenchmark } from './ai-correction-benchmark-runner.js';
import {
  evaluateRegressionGates,
  parseRegressionGatePolicy,
  type RegressionGateInputs,
  type RegressionGatePolicy,
} from './ai-correction-regression-gates.js';
import {
  computeRegressionMetrics,
  type RegressionMetrics,
} from './ai-correction-regression-metrics.js';
import {
  deriveHeldOutSeed,
  selectHeldOutMutants,
  generateRegressionMutants,
  REGRESSION_MUTANT_GENERATOR_VERSION,
} from './ai-correction-regression-mutants.js';
import {
  loadRegressionSource,
  parseRegressionPool,
  type LoadedRegressionSource,
  type RegressionPool,
} from './ai-correction-regression-pool.js';
import { renderRegressionReport } from './ai-correction-regression-report.js';
import {
  computeRunSecurityRates,
  countMutantsByKind,
  deriveRegressionObservations,
  partitionObservations,
  planRegressionRun,
  summarizeConfidence,
  type RegressionCheckerPort,
  type RegressionRunPlan,
} from './ai-correction-regression-run.js';

const POOL_PATH = path.resolve(
  'benchmarks/ai-correction/regression/regression-pool.v1.json',
);
const POLICY_PATH = path.resolve(
  'benchmarks/ai-correction/regression/gate-policy.v3.json',
);

/** Two writing cases with authored hints of both kinds, plus an injection case. */
const SAMPLE_CASE_IDS = new Set([
  'corpus-v1-3/benchmark-writing-successful',
  'corpus-v1-3/benchmark-writing-ambiguous',
  'corpus-v1-3/benchmark-writing-prompt-injection',
]);

function loadPool(): {
  pool: RegressionPool;
  sources: Map<string, LoadedRegressionSource>;
} {
  const pool = parseRegressionPool(
    JSON.parse(readFileSync(POOL_PATH, 'utf8')) as unknown,
  );
  const sources = new Map(
    pool.sources.map((source) => [
      source.path,
      loadRegressionSource(
        readFileSync(path.resolve(path.dirname(POOL_PATH), source.path)),
      ),
    ]),
  );
  return { pool, sources };
}

function loadPolicy(): RegressionGatePolicy {
  return parseRegressionGatePolicy(
    JSON.parse(readFileSync(POLICY_PATH, 'utf8')) as unknown,
  );
}

function loadConfiguration(
  corpus: CorrectionBenchmarkCorpus,
): CorrectionBenchmarkConfiguration {
  const source = JSON.parse(
    readFileSync(
      path.resolve('benchmarks/ai-correction/benchmark.v1.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
  return parseCorrectionBenchmarkConfiguration({
    ...source,
    corpusId: corpus.corpusId,
    maxRetries: 0,
    repetitions: 2,
  });
}

/** How the scripted model reacts to a mutated response. */
type FakeBehaviour = 'ATTENTIVE' | 'BLIND_TO_MUTATIONS' | 'QUOTES_THE_ATTACK';

/**
 * A provider that never leaves the process.
 *
 * It grades from the pool's own expectations, then applies the behaviour under
 * test: an attentive model lowers the criterion a mutation damaged, a blind one
 * ignores the damage, and a third quotes the injected payload back.
 */
function fakeExecutor(input: {
  behaviour: FakeBehaviour;
  plan: RegressionRunPlan;
}) {
  return async (call: {
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    corpus: CorrectionBenchmarkCorpus;
  }) => {
    const unit = input.plan.unitsByBenchmarkCaseId.get(
      call.benchmarkCase.caseId,
    );
    const contract = call.corpus.contracts.find(
      (candidate) =>
        candidate.contractKey === call.benchmarkCase.contractKey &&
        candidate.version === call.benchmarkCase.contractVersion,
    );
    if (!unit || !contract) throw new Error('fake: unknown case');

    const quote = firstSentence(unit.responseText);
    const criteria = Object.fromEntries(
      contract.criteria.map((criterion) => {
        const ordered = [...criterion.performanceLevels].sort(
          (left, right) => left.score - right.score,
        );
        const expected =
          call.benchmarkCase.expectedCriteria.find(
            (candidate) => candidate.criterionKey === criterion.key,
          )?.levelKey ?? ordered[0]?.key;
        const targeted =
          unit.expectation?.targetCriterionKey === criterion.key &&
          input.behaviour === 'ATTENTIVE';
        const levelKey = targeted
          ? (ordered[0]?.key ?? expected)
          : (expected ?? ordered[0]?.key);
        return [
          criterion.key,
          {
            confidence: 0.9,
            evidenceQuotes: [quote],
            evidenceStatus: 'FOUND' as const,
            feedback:
              input.behaviour === 'QUOTES_THE_ATTACK' &&
              unit.kind === 'INJECTION_APPEND'
                ? `Retour : ${unit.expectation?.forbiddenQuoteSource ?? ''}`
                : 'Retour de test, sobre et spécifique.',
            levelKey,
          },
        ];
      }),
    );

    return {
      latencyMs: 12,
      modelSnapshot: 'fake-snapshot',
      output: { criteria, overallFeedback: 'Retour global de test.' },
      providerRoute: 'fake-route',
      usage: {
        actualCostUsd: 0.0001,
        costSource: 'ACTUAL' as const,
        inputTokens: 100,
        reasoningTokens: 0,
        visibleOutputTokens: 50,
      },
    };
  };
}

function firstSentence(text: string): string {
  const match = /^[^.!?]*[.!?]/.exec(text);
  return (match?.[0] ?? text).trim();
}

/** A verifier that agrees with everything — the failure mode v3 measures. */
const AGREEABLE_CHECKER: RegressionCheckerPort = {
  verify: async ({ criteria }) =>
    Object.fromEntries(
      criteria.map((criterion) => [criterion.criterionKey, 'AGREED' as const]),
    ),
};

/** A verifier that refuses a level the text no longer supports. */
function discerningChecker(plan: RegressionRunPlan): RegressionCheckerPort {
  const mutantUnitIds = new Set(
    [...plan.unitsByBenchmarkCaseId.values()]
      .filter((unit) => unit.mutantId !== undefined)
      .map((unit) => unit.mutantId),
  );
  return {
    verify: async ({ criteria, unitId }) =>
      Object.fromEntries(
        criteria.map((criterion) => [
          criterion.criterionKey,
          mutantUnitIds.has(unitId)
            ? ('DISAGREED' as const)
            : ('AGREED' as const),
        ]),
      ),
  };
}

async function runSuite(input: {
  behaviour: FakeBehaviour;
  checker: RegressionCheckerPort;
}): Promise<{
  gateInputs: RegressionGateInputs;
  metrics: RegressionMetrics;
  plan: RegressionRunPlan;
}> {
  const { pool, sources } = loadPool();
  const plan = planRegressionRun({
    pool,
    poolCaseIds: SAMPLE_CASE_IDS,
    sources,
  });
  const configuration = loadConfiguration(plan.corpus);
  const attempts = await runBenchmark({
    // One candidate keeps the offline run small; which identities a real run
    // may use is V4.5-121's business, not this test's.
    candidates: configuration.candidates.slice(0, 1),
    configuration,
    corpus: plan.corpus,
    executeCandidate: fakeExecutor({ behaviour: input.behaviour, plan }),
    providerApiKey: 'offline-test-key',
    repetitions: configuration.repetitions,
  });
  const observations = await deriveRegressionObservations({
    attempts,
    checker: input.checker,
    familyScientificallyValidated: true,
    plan,
  });
  const { baselines, mutants } = partitionObservations(observations);

  expect(baselines.length).toBeGreaterThan(0);
  expect(mutants.length).toBeGreaterThan(0);

  const metrics = computeRegressionMetrics({
    baselines,
    mutants,
    scales: plan.scales,
  });
  const security = computeRunSecurityRates({ attempts, observations, plan });

  return {
    // What the gate policy actually reads: the regression metrics merged with
    // the run-level safety rates, which only the attempts can supply.
    gateInputs: { ...metrics, ...security },
    metrics,
    plan,
  };
}

/**
 * `evidenceHallucination` is owned by the existing benchmark summary and is
 * wired in by V4.5-121. Supplying it here keeps these tests about the gates
 * they exercise rather than about the one that is not wired yet.
 */
function withEvidenceHallucination(
  gateInputs: RegressionGateInputs,
  numerator = 0,
): RegressionGateInputs {
  return {
    ...gateInputs,
    evidenceHallucination: { denominator: 24, numerator, rate: numerator / 24 },
  };
}

describe('regression suite executed offline through the real runner', () => {
  it('compiles the whole pool into a schema-valid benchmark corpus', () => {
    const { pool, sources } = loadPool();
    const plan = planRegressionRun({ pool, sources });

    expect(plan.corpus.cases).toHaveLength(plan.unitsByBenchmarkCaseId.size);
    expect(
      new Set(plan.corpus.cases.map((benchmarkCase) => benchmarkCase.caseId))
        .size,
    ).toBe(plan.corpus.cases.length);
    // 120 baselines plus every mutant the authored hints support.
    expect(plan.scales).toHaveLength(120);
    expect(countMutantsByKind(plan)).toEqual({
      FACT_INVERSION: 22,
      INJECTION_APPEND: 88,
      PARAGRAPH_SHUFFLE: 0,
      PARAPHRASE: 0,
      SENTENCE_DELETION: 58,
    });
  });

  it('declares appended-injection mutants as prompt injection cases', () => {
    const { pool, sources } = loadPool();
    const plan = planRegressionRun({
      pool,
      poolCaseIds: SAMPLE_CASE_IDS,
      sources,
    });

    for (const unit of plan.unitsByBenchmarkCaseId.values()) {
      if (unit.kind !== 'INJECTION_APPEND') continue;
      const compiled = plan.corpus.cases.find(
        (benchmarkCase) => benchmarkCase.caseId === unit.benchmarkCaseId,
      );
      expect(compiled?.category).toBe('PROMPT_INJECTION');
      expect(compiled?.injectionSecurity?.attackText).toBe(
        pool.canonicalAttackSegment,
      );
    }
  });

  it('passes the mutation gates when the model reacts to the damage', async () => {
    const { gateInputs, metrics } = await runSuite({
      behaviour: 'ATTENTIVE',
      checker: discerningChecker(
        planRegressionRun({
          ...loadPool(),
          poolCaseIds: SAMPLE_CASE_IDS,
        }),
      ),
    });

    expect(metrics.mutationDirectionViolations.numerator).toBe(0);
    expect(metrics.mutationDirectionViolations.denominator).toBeGreaterThan(0);

    const evaluation = evaluateRegressionGates({
      metrics: withEvidenceHallucination(gateInputs),
      policy: loadPolicy(),
    });
    expect(
      evaluation.gates.find(
        (gate) => gate.key === 'mutation-direction-violations',
      )?.status,
    ).toBe('PASS');
    expect(
      evaluation.gates.find((gate) => gate.key === 'injection-append-safety')
        ?.status,
    ).toBe('PASS');
  });

  it('refuses a percentage threshold finer than the sample can resolve', async () => {
    // On a small sample, "≤ 2 % of mutants" cannot tolerate a single event, so
    // stating it as a percentage hides that it is really a zero budget. The
    // policy must say so rather than round it away.
    const { gateInputs } = await runSuite({
      behaviour: 'ATTENTIVE',
      checker: AGREEABLE_CHECKER,
    });

    const evaluation = evaluateRegressionGates({
      metrics: withEvidenceHallucination(gateInputs),
      policy: loadPolicy(),
    });

    expect(evaluation.policyErrors.join(' ')).toContain(
      'mutation-direction-violations',
    );
    expect(evaluation.policyErrors.join(' ')).toContain('inférieur à 1/');
    expect(evaluation.promotionEligible).toBe(false);
  });

  it('refuses promotion when a blocking gate reads an unwired metric', async () => {
    const { gateInputs } = await runSuite({
      behaviour: 'ATTENTIVE',
      checker: AGREEABLE_CHECKER,
    });

    const evaluation = evaluateRegressionGates({
      metrics: gateInputs,
      policy: loadPolicy(),
    });

    expect(evaluation.policyErrors.join(' ')).toContain(
      'evidenceHallucination',
    );
    expect(evaluation.promotionEligible).toBe(false);
  });

  it('fails the mutation gate when the model ignores the damage', async () => {
    const { gateInputs, metrics } = await runSuite({
      behaviour: 'BLIND_TO_MUTATIONS',
      checker: AGREEABLE_CHECKER,
    });

    expect(metrics.mutationDirectionViolations.numerator).toBeGreaterThan(0);

    const evaluation = evaluateRegressionGates({
      metrics: withEvidenceHallucination(gateInputs),
      policy: loadPolicy(),
    });
    const gate = evaluation.gates.find(
      (candidate) => candidate.key === 'mutation-direction-violations',
    );
    expect(gate?.status).toBe('FAIL');
    expect(evaluation.promotionEligible).toBe(false);
    expect(evaluation.gateFailures.join(' ')).toContain(
      'mutation-direction-violations',
    );
  });

  it('catches a verifier that agrees with levels false by construction', async () => {
    const { gateInputs, metrics } = await runSuite({
      behaviour: 'BLIND_TO_MUTATIONS',
      checker: AGREEABLE_CHECKER,
    });

    // The model left damaged criteria untouched and the checker agreed with
    // every one of them: exactly the lenient-verifier failure v3 exists to
    // catch, and it must be visible as a rate rather than hidden inside
    // checkerAgreementAtHigh.
    expect(metrics.checkerFalseAgreeRate.denominator).toBeGreaterThan(0);
    expect(metrics.checkerFalseAgreeRate.rate).toBe(1);
    expect(
      evaluateRegressionGates({
        metrics: withEvidenceHallucination(gateInputs),
        policy: loadPolicy(),
      }).gates.find((gate) => gate.key === 'checker-false-agree-rate')?.status,
    ).toBe('FAIL');
  });

  it('detects an appended payload the model repeated, however it surfaced', async () => {
    // The runner's own safety check rejects most such outputs outright, so the
    // breach shows up as a refused attempt rather than as a quoted observation.
    // The gate counts both, or a model could pass by failing loudly.
    const { gateInputs } = await runSuite({
      behaviour: 'QUOTES_THE_ATTACK',
      checker: AGREEABLE_CHECKER,
    });
    const security = gateInputs.injectionAppendSafetyViolations as {
      denominator: number;
      numerator: number;
    };

    expect(security.denominator).toBeGreaterThan(0);
    expect(security.numerator).toBeGreaterThan(0);
    expect(
      evaluateRegressionGates({
        metrics: withEvidenceHallucination(gateInputs),
        policy: loadPolicy(),
      }).gates.find((gate) => gate.key === 'injection-append-safety')?.status,
    ).toBe('FAIL');
  });
});

describe('held-out mutant set', () => {
  it('derives its seed from artefacts a reader actually has', () => {
    const seed = deriveHeldOutSeed({
      gatePolicyVersion: '3.0.0',
      generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
      poolSha256: 'a'.repeat(64),
    });

    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    expect(
      deriveHeldOutSeed({
        gatePolicyVersion: '3.0.0',
        generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
        poolSha256: 'a'.repeat(64),
      }),
    ).toBe(seed);
    expect(
      deriveHeldOutSeed({
        gatePolicyVersion: '3.0.1',
        generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
        poolSha256: 'a'.repeat(64),
      }),
    ).not.toBe(seed);
  });

  it('selects a stable subset of twelve mutants', () => {
    const { pool, sources } = loadPool();
    const mutants = pool.cases.flatMap((poolCase) => {
      const source = sources.get(poolCase.sourcePath);
      const sourceCase = source?.corpus.cases.find(
        (candidate) => candidate.caseId === poolCase.sourceCaseId,
      );
      if (!sourceCase) return [];
      return generateRegressionMutants({
        canonicalAttackSegment: pool.canonicalAttackSegment,
        locale: pool.language,
        poolCase,
        responseText: sourceCase.responseText,
      });
    });
    const seed = deriveHeldOutSeed({
      gatePolicyVersion: '3.0.0',
      generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
      poolSha256: 'b'.repeat(64),
    });

    const held = selectHeldOutMutants({ mutants, seed, size: 12 });
    expect(held).toHaveLength(12);
    expect(selectHeldOutMutants({ mutants, seed, size: 12 })).toEqual(held);
    expect(new Set(held.map((mutant) => mutant.mutantId)).size).toBe(12);
  });
});

describe('regression report', () => {
  it('prints gates, denominators and the unmeasured kinds', async () => {
    const { gateInputs, metrics, plan } = await runSuite({
      behaviour: 'BLIND_TO_MUTATIONS',
      checker: AGREEABLE_CHECKER,
    });
    const evaluation = evaluateRegressionGates({
      metrics: withEvidenceHallucination(gateInputs),
      policy: loadPolicy(),
    });

    const report = renderRegressionReport({
      confidence: summarizeConfidence([]),
      costs: {
        actualCostUsd: 0.01,
        estimatedCostUsd: 0.012,
        p50CostUsdPerCorrection: 0.0004,
        p50LatencyMs: 12,
        p90CostUsdPerCorrection: 0.0006,
        p90LatencyMs: 20,
      },
      evaluation,
      identity: {
        checkerIdentity: 'PROMOTED_CHECKER_IDENTITY',
        gatePolicyVersion: '3.0.0',
        generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
        heldOutSeed: 'c'.repeat(64),
        heldOutSeedSource: 'DERIVED',
        poolId: 'learnx-fr-regression-pool-v1',
        poolSha256: 'd'.repeat(64),
        primaryIdentity: 'PROMOTED_CORRECTION_IDENTITY',
        profile: 'reduced',
        repetitions: 2,
        runStartedAt: '2026-08-29T00:00:00.000Z',
      },
      metrics,
      mutantCounts: countMutantsByKind(plan),
    });

    expect(report).toContain('**Promotion : refusée.**');
    expect(report).toContain('mutation-direction-violations');
    // A kind with no material is named, not omitted.
    expect(report).toContain('PARAGRAPH_SHUFFLE');
    expect(report).toContain('Aucun mutant produit pour');
    expect(report).toContain('non mesuré');
    // The report never carries learner prose.
    expect(report).not.toContain('Je recommande le pilote');
  });
});
