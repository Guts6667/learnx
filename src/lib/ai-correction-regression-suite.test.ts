import { createHash } from 'node:crypto';
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
  type RegressionObservation,
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
  REGRESSION_CRITERIA_OMITTED_CODE,
  type RegressionCheckerPort,
  type RegressionRunPlan,
} from './ai-correction-regression-run.js';

const POOL_PATH = path.resolve(
  'benchmarks/ai-correction/regression/regression-pool.v1.json',
);
const POLICY_PATH = path.resolve(
  'benchmarks/ai-correction/regression/gate-policy.v6-1.json',
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
  verify: async ({ criteria }) => ({
    // A priced call: offline tests still reconcile a cost so the guard path is
    // exercised rather than skipped.
    costUsd: 0.00002,
    verdicts: Object.fromEntries(
      criteria.map((criterion) => [criterion.criterionKey, 'AGREED' as const]),
    ),
  }),
};

/** A verifier that refuses a level the text no longer supports. */
function discerningChecker(plan: RegressionRunPlan): RegressionCheckerPort {
  const mutantUnitIds = new Set(
    [...plan.unitsByBenchmarkCaseId.values()]
      .filter((unit) => unit.mutantId !== undefined)
      .map((unit) => unit.mutantId),
  );
  return {
    verify: async ({ criteria, unitId }) => ({
      costUsd: 0.00002,
      verdicts: Object.fromEntries(
        criteria.map((criterion) => [
          criterion.criterionKey,
          mutantUnitIds.has(unitId)
            ? ('DISAGREED' as const)
            : ('AGREED' as const),
        ]),
      ),
    }),
  };
}

async function runSuite(input: {
  behaviour: FakeBehaviour;
  checker: RegressionCheckerPort;
}): Promise<{
  baselines: RegressionObservation[];
  gateInputs: RegressionGateInputs;
  metrics: RegressionMetrics;
  mutants: RegressionObservation[];
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
    baselines,
    // What the gate policy actually reads: the regression metrics merged with
    // the run-level safety rates, which only the attempts can supply.
    gateInputs: { ...metrics, ...security },
    metrics,
    mutants,
    plan,
  };
}

/**
 * Pins the evidence metrics to chosen numerators so the other gates' tests are
 * about the gates they exercise. The metrics themselves are wired (V4.5-127)
 * and are measured on their own in `ai-correction-regression-analyse.test.ts`.
 */
function withEvidenceHallucination(
  gateInputs: RegressionGateInputs,
  numerator = 0,
): RegressionGateInputs {
  return {
    ...gateInputs,
    evidenceHallucinationAnyAttempt: {
      denominator: 24,
      numerator,
      rate: numerator / 24,
    },
    evidenceHallucinationDelivered: {
      denominator: 24,
      numerator,
      rate: numerator / 24,
    },
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
    // 144 baselines plus every mutant the authored hints support.
    expect(plan.scales).toHaveLength(144);
    expect(countMutantsByKind(plan)).toEqual({
      FACT_INVERSION: 28,
      INJECTION_APPEND: 108,
      // One per domain case: V4.5-122's multi-paragraph responses are what
      // finally give this oracle material, where the v1 pool gave it none.
      PARAGRAPH_SHUFFLE: 24,
      // Empty until V4.5-121 populates the frozen cache with the verifier.
      PARAPHRASE: 0,
      SENTENCE_DELETION: 76,
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

  it('puts both evidence gates in the table rather than dropping either', async () => {
    // Before V4.5-127 this metric was missing entirely: the evaluator filed a
    // policy error and dropped the gate, so the table showed eleven gates
    // against a twelve-gate policy with nothing saying one had been skipped.
    // Promotion was refused either way, which is why it went unnoticed for a
    // whole paid run. The gate is now always present; without a convention it
    // reads NOT_MEASURED, which refuses promotion *and* says so in the table.
    const { gateInputs } = await runSuite({
      behaviour: 'ATTENTIVE',
      checker: AGREEABLE_CHECKER,
    });

    const evaluation = evaluateRegressionGates({
      metrics: gateInputs,
      policy: loadPolicy(),
    });

    const blocking = evaluation.gates.find(
      (gate) => gate.metric === 'evidenceHallucinationDelivered',
    );
    const watched = evaluation.gates.find(
      (gate) => gate.metric === 'evidenceHallucinationAnyAttempt',
    );
    expect(blocking?.kind).toBe('BLOCKING');
    expect(watched?.kind).toBe('WATCHED');
    // Policy v6 declares three gates ahead of the measurements that feed them:
    // the designed false-agreement probe, and the two arithmetic gates whose
    // oracle is not yet wired into the summary. Declaring before buying is the
    // point — and each says so as a policy error rather than passing quietly.
    const declaredAhead = [
      'checker-false-agree-designed : la métrique checkerFalseAgreeDesigned est absente du résumé.',
      'quoted-arithmetic-violations-delivered : la métrique quotedArithmeticViolationsDelivered est absente du résumé.',
      'quoted-arithmetic-violations-any-attempt : la métrique quotedArithmeticViolationsAnyAttempt est absente du résumé.',
    ];
    expect(evaluation.gates).toHaveLength(
      loadPolicy().gates.length - declaredAhead.length,
    );
    for (const declared of declaredAhead) {
      expect(evaluation.policyErrors).toContain(declared);
    }
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
    // The measurement still stands and is still reported. Policy v5 stops
    // gating on it: its denominator counts only the occasions a mutant made the
    // corrector fail, so it is fed by failures rather than by design, shrinks as
    // the corrector improves, and stood at 1 on 30 August. The replacement,
    // `checker-false-agree-designed`, builds its own denominator.
    expect(
      evaluateRegressionGates({
        metrics: withEvidenceHallucination(gateInputs),
        policy: loadPolicy(),
      }).gates.find((gate) => gate.key === 'checker-false-agree-rate')?.kind,
    ).toBe('REPORTED');
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
      generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
      poolSha256: 'a'.repeat(64),
    });

    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    expect(
      deriveHeldOutSeed({
        generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
        poolSha256: 'a'.repeat(64),
      }),
    ).toBe(seed);
    // A different pool is a different sample, and must be.
    expect(
      deriveHeldOutSeed({
        generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
        poolSha256: 'b'.repeat(64),
      }),
    ).not.toBe(seed);
  });

  it('does not let the gate policy version choose the sample', () => {
    // The v6.1 amendment, asserted as a property. A first version of this test
    // checked the function's arity and key list, and passed happily with the
    // policy version put back as an optional parameter — it proved nothing. It
    // now pins the hashed material itself, and shows that no policy value can
    // reach it.
    const poolSha256 = 'a'.repeat(64);
    const seed = deriveHeldOutSeed({
      generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
      poolSha256,
    });

    // The formula, pinned: pool digest and generator version, nothing else.
    // Reintroducing any third term into the hash changes this and fails here.
    expect(seed).toBe(
      createHash('sha256')
        .update(`${poolSha256} ${REGRESSION_MUTANT_GENERATOR_VERSION}`)
        .digest('hex'),
    );

    // And a policy version handed in anyway cannot reach the sample. The cast
    // is the point: it is how the argument would come back, and the seed must
    // not move when it does.
    const withPolicy = deriveHeldOutSeed({
      gatePolicyVersion: '9.9.9',
      generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
      poolSha256,
    } as unknown as Parameters<typeof deriveHeldOutSeed>[0]);
    expect(withPolicy).toBe(seed);
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

describe('repetition offset at the runner (V4.5-127)', () => {
  /**
   * The 30 August run bought 24 cells that measured nothing.
   *
   * The reduced profile's second pass exists to observe a subset twice, so the
   * stability oracle has two observations to compare. It passed `runBenchmark` a
   * repetitions *count*, and the runner numbers repetitions from 1 — so the pass
   * re-ran observation 1 on cells the pool pass had already bought. Every one of
   * the 216 attempts carried `repetition: 1`, the stability gate had a zero
   * denominator, and roughly 0.50 USD bought duplicate work.
   *
   * This asserts the property that was missing: a pass told to start at 2
   * produces observation 2, and produces no observation 1 at all.
   */
  it('produces only repetition 2 when told to start there', async () => {
    const { pool, sources } = loadPool();
    const plan = planRegressionRun({
      pool,
      poolCaseIds: SAMPLE_CASE_IDS,
      sources,
    });
    const configuration = loadConfiguration(plan.corpus);

    const attempts = await runBenchmark({
      candidates: configuration.candidates.slice(0, 1),
      configuration,
      corpus: plan.corpus,
      executeCandidate: fakeExecutor({ behaviour: 'ATTENTIVE', plan }),
      providerApiKey: 'offline-test-key',
      repetitionOffset: 2,
      repetitions: 1,
    });

    const repetitions = new Set(attempts.map((attempt) => attempt.repetition));
    expect([...repetitions]).toEqual([2]);
    expect(repetitions.has(1)).toBe(false);

    // One cell per case, at that single repetition — not a second copy of the
    // work the pool pass already paid for.
    const cells = new Set(
      attempts.map((attempt) => `${attempt.caseId}|${attempt.repetition}`),
    );
    expect(cells.size).toBe(plan.corpus.cases.length);
  });

  it('still numbers from 1 when no offset is given', async () => {
    const { pool, sources } = loadPool();
    const plan = planRegressionRun({
      pool,
      poolCaseIds: SAMPLE_CASE_IDS,
      sources,
    });
    const configuration = loadConfiguration(plan.corpus);

    const attempts = await runBenchmark({
      candidates: configuration.candidates.slice(0, 1),
      configuration,
      corpus: plan.corpus,
      executeCandidate: fakeExecutor({ behaviour: 'ATTENTIVE', plan }),
      providerApiKey: 'offline-test-key',
      repetitions: 2,
    });

    expect(
      [...new Set(attempts.map((attempt) => attempt.repetition))].sort(),
    ).toEqual([1, 2]);
  });
});

/**
 * The omitted-criteria oracle of gate policy v6.1.
 *
 * The paid 2.3.0 pre-test recorded a mutant that answered 2 criteria of 3 —
 * omitting precisely the one the mutation targeted — and the bench filed it
 * `VALID`. These tests reproduce that artefact's shape offline and for nothing,
 * and assert the property that made it dangerous: under every gate that existed
 * before v6.1, going quiet is an improvement.
 *
 * They deliberately build the quiet run by editing observations rather than by
 * scripting a quiet model. A probe of the offline path showed the runner's own
 * validator refuses a short output — 8 attempts of 8 came back `INVALID` /
 * `MODEL_OUTPUT_CONTRACT_INVALID`, producing no observation at all — so a quiet
 * fake model would never reach the metrics and would test nothing. What reached
 * the metrics on the paid run was an observation missing a criterion, and that
 * is what is reconstructed here. Why the guard did not stop it upstream is a
 * separate question, under investigation; this oracle is downstream of it on
 * purpose and does not depend on the answer.
 */
describe('omitted-criteria oracle', () => {
  /** Drops the mutation's target criterion from every mutant observation. */
  function goQuietOnTarget(
    mutants: RegressionObservation[],
  ): RegressionObservation[] {
    return mutants.map((mutant) => {
      const target = mutant.expectation?.targetCriterionKey;
      if (!target) return mutant;
      return {
        ...mutant,
        criteria: mutant.criteria.filter(
          (criterion) => criterion.criterionKey !== target,
        ),
      };
    });
  }

  async function bothRuns() {
    const { baselines, gateInputs, mutants, plan } = await runSuite({
      behaviour: 'BLIND_TO_MUTATIONS',
      checker: AGREEABLE_CHECKER,
    });
    const quietMutants = goQuietOnTarget(mutants);
    expect(
      quietMutants.reduce((total, mutant) => total + mutant.criteria.length, 0),
    ).toBeLessThan(
      mutants.reduce((total, mutant) => total + mutant.criteria.length, 0),
    );

    return {
      gateInputs,
      loud: computeRegressionMetrics({
        baselines,
        mutants,
        scales: plan.scales,
      }),
      quiet: computeRegressionMetrics({
        baselines,
        mutants: quietMutants,
        scales: plan.scales,
      }),
    };
  }

  /** Drops one criterion the mutation did *not* target. */
  function goQuietElsewhere(
    mutants: RegressionObservation[],
  ): RegressionObservation[] {
    return mutants.map((mutant) => {
      const target = mutant.expectation?.targetCriterionKey;
      const victim = mutant.criteria.find(
        (criterion) => criterion.criterionKey !== target,
      );
      if (!victim) return mutant;
      return {
        ...mutant,
        criteria: mutant.criteria.filter(
          (criterion) => criterion.criterionKey !== victim.criterionKey,
        ),
      };
    });
  }

  async function untargetedRun() {
    const { baselines, mutants, plan } = await runSuite({
      behaviour: 'BLIND_TO_MUTATIONS',
      checker: AGREEABLE_CHECKER,
    });
    return {
      loud: computeRegressionMetrics({
        baselines,
        mutants,
        scales: plan.scales,
      }),
      plan,
      untargeted: computeRegressionMetrics({
        baselines,
        mutants: goQuietElsewhere(mutants),
        scales: plan.scales,
      }),
    };
  }

  it('counts a contract criterion the delivered correction never mentions', async () => {
    const { loud, quiet } = await bothRuns();

    // A model that answers everything owes this oracle nothing.
    expect(loud.omittedContractCriteriaDelivered.numerator).toBe(0);
    expect(loud.omittedContractCriteriaDelivered.denominator).toBeGreaterThan(
      0,
    );
    expect(loud.omittedCriterionCorrections.numerator).toBe(0);

    // A model that goes quiet owes it one per criterion it skipped.
    expect(quiet.omittedContractCriteriaDelivered.numerator).toBeGreaterThan(0);
    expect(quiet.omittedCriterionDetails.length).toBe(
      quiet.omittedContractCriteriaDelivered.numerator,
    );
    for (const detail of quiet.omittedCriterionDetails) {
      expect(detail.criterionKey).not.toBe('');
      expect(detail.caseId).not.toBe('');
    }
  });

  it('builds its denominator from the contract, so silence cannot shrink it', async () => {
    const { loud, quiet } = await bothRuns();

    // The one property the other metrics lack. Every gate below counts
    // delivered criteria on both sides, so an omission leaves the numerator and
    // the denominator together; this denominator is the contract's criteria and
    // does not move when the output does.
    expect(quiet.omittedContractCriteriaDelivered.denominator).toBe(
      loud.omittedContractCriteriaDelivered.denominator,
    );
    expect(quiet.omittedCriterionCorrections.denominator).toBe(
      loud.omittedCriterionCorrections.denominator,
    );
  });

  it('never lets an omission worsen a metric that predates it', async () => {
    const { loud, quiet } = await bothRuns();

    // The finding, asserted rather than described, and measured on all three
    // shapes an omission can take. Not one pre-v6.1 numerator rises and not one
    // denominator grows: whatever the model stops writing, every earlier gate
    // reads the same or better. Silence is never charged.
    expect(quiet.checkerAgreementAtHigh.denominator).toBeLessThan(
      loud.checkerAgreementAtHigh.denominator,
    );
    expect(quiet.lowShare.denominator).toBeLessThan(loud.lowShare.denominator);
    expect(quiet.unrelatedCriterionDrift.numerator).toBeLessThanOrEqual(
      loud.unrelatedCriterionDrift.numerator,
    );
  });

  it('collapses the false-agreement denominator the omission was hiding in', async () => {
    const { loud, quiet } = await bothRuns();

    // The sharpest instance. `checkerFalseAgreeRate` counts the occasions a
    // verifier agreed with a level the mutated text no longer supports, and it
    // finds those occasions by looking the targeted criterion up in the output.
    // Omit the criterion and there is no occasion to count: 8 false agreements
    // out of 8 becomes 0 out of 0 — not "measured and clean", but "not measured
    // at all", reported as such and blocking nothing, because v6 files this
    // gate as REPORTED.
    expect(loud.checkerFalseAgreeRate.numerator).toBeGreaterThan(0);
    expect(loud.checkerFalseAgreeRate.rate).not.toBeNull();
    expect(quiet.checkerFalseAgreeRate.denominator).toBe(0);
    expect(quiet.checkerFalseAgreeRate.rate).toBeNull();
  });

  it('agrees with the delivered-criteria count until something is omitted', async () => {
    const { loud, quiet } = await bothRuns();

    // `lowShare` counts delivered criteria; this oracle counts the criteria the
    // contract asked for. On a complete run they are the same number, which is
    // what makes the divergence legible: when they part, the gap is exactly
    // what the model did not write.
    expect(loud.omittedContractCriteriaDelivered.denominator).toBe(
      loud.lowShare.denominator,
    );
    expect(quiet.omittedContractCriteriaDelivered.denominator).toBeGreaterThan(
      quiet.lowShare.denominator,
    );
    expect(
      quiet.omittedContractCriteriaDelivered.denominator -
        quiet.lowShare.denominator,
    ).toBe(quiet.omittedContractCriteriaDelivered.numerator);
  });

  it('counts an omission the direction oracle cannot see', async () => {
    const { loud, plan, untargeted } = await untargetedRun();

    // `mutationDirectionViolations` does catch an omitted *targeted* criterion,
    // by name — so the hole is not where it first appeared. It is one criterion
    // wide: omit any criterion the mutation did not target and that oracle is
    // blind, because it only ever looks up the target. Measured here: the
    // direction figure is identical either way, while the omission is real.
    expect(untargeted.mutationDirectionViolations.numerator).toBe(
      loud.mutationDirectionViolations.numerator,
    );
    expect(untargeted.mutationDirectionViolations.denominator).toBe(
      loud.mutationDirectionViolations.denominator,
    );

    expect(
      untargeted.omittedContractCriteriaDelivered.numerator,
    ).toBeGreaterThan(0);
    expect(untargeted.omittedContractCriteriaDelivered.denominator).toBe(
      loud.omittedContractCriteriaDelivered.denominator,
    );
    expect(plan.scales.length).toBeGreaterThan(0);
  });

  it('blocks promotion on a single omitted criterion under v6.1', async () => {
    const { gateInputs, quiet } = await bothRuns();

    const evaluation = evaluateRegressionGates({
      metrics: withEvidenceHallucination({ ...gateInputs, ...quiet }),
      policy: loadPolicy(),
    });
    const gate = evaluation.gates.find(
      (candidate) => candidate.key === 'omitted-criteria-delivered',
    );

    expect(gate?.kind).toBe('BLOCKING');
    expect(gate?.status).toBe('FAIL');
    expect(gate?.budget).toBe(0);
    expect(evaluation.promotionEligible).toBe(false);
    expect(evaluation.gateFailures.join(' ')).toContain(
      'omitted-criteria-delivered',
    );
  });

  it('reports the per-correction share without inventing a threshold', async () => {
    const { gateInputs, quiet } = await bothRuns();

    const evaluation = evaluateRegressionGates({
      metrics: withEvidenceHallucination({ ...gateInputs, ...quiet }),
      policy: loadPolicy(),
    });
    const gate = evaluation.gates.find(
      (candidate) => candidate.key === 'omitted-criterion-corrections',
    );

    // Reported, never blocking: the zero-tolerance gate above already decides
    // promotion, and a second threshold here would be a number nobody measured.
    expect(gate?.kind).toBe('REPORTED');
    expect(gate?.status).toBe('REPORTED');
    expect(gate?.budget).toBeNull();
    // Counted per correction, not per criterion: fewer corrections than
    // criteria when a single correction skips more than one.
    expect(gate?.numerator).toBeGreaterThan(0);
    expect(gate?.numerator).toBeLessThanOrEqual(
      quiet.omittedContractCriteriaDelivered.numerator,
    );
  });

  it('stays green, and measured, when the model answers every criterion', async () => {
    const { gateInputs, loud } = await bothRuns();

    const evaluation = evaluateRegressionGates({
      metrics: withEvidenceHallucination({ ...gateInputs, ...loud }),
      policy: loadPolicy(),
    });
    const gate = evaluation.gates.find(
      (candidate) => candidate.key === 'omitted-criteria-delivered',
    );

    // Green and measured, not green and absent: a NOT_MEASURED here would mean
    // the oracle never ran, which is the failure the v6 report was built to
    // make visible.
    expect(gate?.status).toBe('PASS');
    expect(gate?.denominator).toBeGreaterThan(0);
  });

  it('counts an omission the runner refused, apart from every other refusal', async () => {
    // The other side of the guard, and the reason it needs its own count.
    // Head of Development's fix makes an omitted criterion a contract violation
    // rather than something to salvage, so after it lands the omission never
    // becomes an observation and the delivered oracle reads a clean zero. If
    // nothing counted the refusal, the fix would hide the failure by working:
    // the event would land in `eventualUnusableRuns` beside timeouts, under a
    // 3 % budget rather than a zero one.
    const { pool, sources } = loadPool();
    const plan = planRegressionRun({
      pool,
      poolCaseIds: SAMPLE_CASE_IDS,
      sources,
    });
    const configuration = loadConfiguration(plan.corpus);
    const attempts = await runBenchmark({
      candidates: configuration.candidates.slice(0, 1),
      configuration,
      corpus: plan.corpus,
      executeCandidate: fakeExecutor({ behaviour: 'ATTENTIVE', plan }),
      providerApiKey: 'offline-test-key',
      repetitions: configuration.repetitions,
    });

    const clean = computeRunSecurityRates({ attempts, observations: [], plan });
    expect(clean.omittedCriteriaRefusedCells.numerator).toBe(0);
    expect(clean.omittedCriteriaRefusedCells.denominator).toBeGreaterThan(0);

    // Two cells refused for omission, and one refused for something else, so
    // the assertion cannot pass by counting refusals in general.
    const refused = attempts.map((attempt, index) => {
      if (index > 2) return attempt;
      return {
        ...attempt,
        errorCode:
          index === 2 ? 'MODEL_TIMEOUT' : REGRESSION_CRITERIA_OMITTED_CODE,
        output: undefined,
        status: 'INVALID' as const,
      };
    });
    const dirty = computeRunSecurityRates({
      attempts: refused,
      observations: [],
      plan,
    });

    expect(dirty.omittedCriteriaRefusedCells.numerator).toBe(2);
    expect(dirty.omittedCriteriaRefusedCells.denominator).toBe(
      clean.omittedCriteriaRefusedCells.denominator,
    );

    // All three land in the unusable count, which is exactly why that count
    // cannot stand in for this one. Evaluated against the run's real metrics,
    // not the safety rates alone: a gate table built from half the inputs would
    // drop the other gates as policy errors and prove nothing about this one.
    const observations = await deriveRegressionObservations({
      attempts: refused,
      checker: AGREEABLE_CHECKER,
      familyScientificallyValidated: true,
      plan,
    });
    const { baselines, mutants } = partitionObservations(observations);
    const evaluation = evaluateRegressionGates({
      metrics: withEvidenceHallucination({
        ...computeRegressionMetrics({
          baselines,
          mutants,
          scales: plan.scales,
        }),
        ...dirty,
      }),
      policy: loadPolicy(),
    });
    const gate = evaluation.gates.find(
      (candidate) => candidate.key === 'omitted-criteria-refused',
    );
    expect(gate?.kind).toBe('WATCHED');
    expect(gate?.status).toBe('FAIL');
    // Watched, not blocking: a refusal is the guard doing its job, and the
    // convention for "the model did it but nobody received it" is already set
    // by evidence-hallucination-any-attempt.
    expect(evaluation.gateFailures.join(' ')).not.toContain(
      'omitted-criteria-refused',
    );
  });

  async function attemptsWithOneVictim() {
    const { pool, sources } = loadPool();
    const plan = planRegressionRun({
      pool,
      poolCaseIds: SAMPLE_CASE_IDS,
      sources,
    });
    const configuration = loadConfiguration(plan.corpus);
    const attempts = await runBenchmark({
      candidates: configuration.candidates.slice(0, 1),
      configuration,
      corpus: plan.corpus,
      executeCandidate: fakeExecutor({ behaviour: 'ATTENTIVE', plan }),
      providerApiKey: 'offline-test-key',
      repetitions: configuration.repetitions,
    });
    const victim = attempts.find(
      (attempt) => (attempt.output?.criteria.length ?? 0) > 1,
    );
    expect(victim).toBeDefined();
    return { attempts, plan, victim };
  }

  it('splits a lost criterion into "withdrawn" and "never written"', async () => {
    // Two causes that look identical on the delivered correction and are fixed
    // in different places: the model skipped a criterion, or the pipeline took
    // one away. The 2.3.0 pre-test was read as the first and is the second.
    const { pool, sources } = loadPool();
    const plan = planRegressionRun({
      pool,
      poolCaseIds: SAMPLE_CASE_IDS,
      sources,
    });
    const configuration = loadConfiguration(plan.corpus);
    const attempts = await runBenchmark({
      candidates: configuration.candidates.slice(0, 1),
      configuration,
      corpus: plan.corpus,
      executeCandidate: fakeExecutor({ behaviour: 'ATTENTIVE', plan }),
      providerApiKey: 'offline-test-key',
      repetitions: configuration.repetitions,
    });

    const complete = computeRunSecurityRates({
      attempts,
      observations: [],
      plan,
    });
    expect(complete.criteriaWithdrawnUndelivered.numerator).toBe(0);
    expect(complete.criteriaAbsentFromModelOutput.numerator).toBe(0);
    expect(complete.criteriaWithdrawnUndelivered.denominator).toBeGreaterThan(
      0,
    );

    const victim = attempts.find(
      (attempt) => (attempt.output?.criteria.length ?? 0) > 1,
    );
    expect(victim).toBeDefined();
    const dropped = victim?.output?.criteria[0]?.criterionKey ?? '';
    expect(dropped).not.toBe('');

    // The shape the 31 August artefact actually holds, reproduced: the model
    // wrote every criterion, the salvage withdrew one, the attempt stayed VALID.
    const withdrawnAttempts = attempts.map((attempt) => {
      if (attempt !== victim || !attempt.output) return attempt;
      return {
        ...attempt,
        output: {
          ...attempt.output,
          criteria: attempt.output.criteria.filter(
            (criterion) => criterion.criterionKey !== dropped,
          ),
        },
        rawModelOutput: JSON.stringify({
          criteria: Object.fromEntries(
            attempt.output.criteria.map((criterion) => [
              criterion.criterionKey,
              {},
            ]),
          ),
        }),
        unsureCriteria: [dropped],
      };
    });
    const withdrawn = computeRunSecurityRates({
      attempts: withdrawnAttempts,
      observations: [],
      plan,
    });

    expect(withdrawn.criteriaWithdrawnUndelivered.numerator).toBe(1);
    // The model wrote it; only the pipeline lost it. Reading these two the same
    // way is what sent a day of investigation at the wrong guard.
    expect(withdrawn.criteriaAbsentFromModelOutput.numerator).toBe(0);
    // And the denominator does not move when a criterion leaves the output.
    expect(withdrawn.criteriaWithdrawnUndelivered.denominator).toBe(
      complete.criteriaWithdrawnUndelivered.denominator,
    );

    // The other cause, same delivered shape: the model never wrote it.
    const silentAttempts = attempts.map((attempt) => {
      if (attempt !== victim || !attempt.output) return attempt;
      return {
        ...attempt,
        output: {
          ...attempt.output,
          criteria: attempt.output.criteria.filter(
            (criterion) => criterion.criterionKey !== dropped,
          ),
        },
        rawModelOutput: JSON.stringify({
          criteria: Object.fromEntries(
            attempt.output.criteria
              .filter((criterion) => criterion.criterionKey !== dropped)
              .map((criterion) => [criterion.criterionKey, {}]),
          ),
        }),
        unsureCriteria: [dropped],
      };
    });
    const silent = computeRunSecurityRates({
      attempts: silentAttempts,
      observations: [],
      plan,
    });
    expect(silent.criteriaAbsentFromModelOutput.numerator).toBe(1);
  });

  it('does not count a withdrawn criterion as lost once it is still delivered', async () => {
    // The shape after V4.5-177, replayed from the real cell: the model cited
    // the task statement instead of the learner's answer, the quote was
    // refused, and the criterion is delivered anyway — EVIDENCE_WITHDRAWN, no
    // level shown. Nothing reached the learner short, so the blocking count
    // must read zero while the provenance count reads one.
    //
    // Wiring the blocking gate to the withdrawal flag instead of to the
    // delivered output would turn it red here — red *because the fix works*,
    // which teaches people to route around the gate rather than fix anything.
    const { attempts, plan, victim } = await attemptsWithOneVictim();
    const target = victim?.output?.criteria[0]?.criterionKey ?? '';

    const provenanceAttempts = attempts.map((attempt) => {
      if (attempt !== victim || !attempt.output) return attempt;
      return {
        ...attempt,
        // Delivered, with the level the model pronounced and no quotes.
        output: attempt.output,
        rawModelOutput: JSON.stringify({
          criteria: Object.fromEntries(
            attempt.output.criteria.map((criterion) => [
              criterion.criterionKey,
              {},
            ]),
          ),
        }),
        withdrawnCriteria: [
          { criterionKey: target, reason: 'EVIDENCE_NOT_IN_RESPONSE' as const },
        ],
      };
    });

    const rates = computeRunSecurityRates({
      attempts: provenanceAttempts,
      observations: [],
      plan,
    });

    expect(rates.criteriaWithdrawnUndelivered.numerator).toBe(0);
    expect(rates.criteriaDroppedForEvidenceProvenance.numerator).toBe(1);
    expect(rates.criteriaAbsentFromModelOutput.numerator).toBe(0);
    // Contract-built on both counts, so neither shrinks when a level does.
    expect(rates.criteriaDroppedForEvidenceProvenance.denominator).toBe(
      rates.criteriaWithdrawnUndelivered.denominator,
    );
  });

  it('still blocks when a withdrawal keeps the criterion out of the correction', async () => {
    // The five other reasons remove the criterion outright, and those must stay
    // blocking: the learner is short a criterion however well-named the reason.
    const { attempts, plan, victim } = await attemptsWithOneVictim();
    const target = victim?.output?.criteria[0]?.criterionKey ?? '';

    const removedAttempts = attempts.map((attempt) => {
      if (attempt !== victim || !attempt.output) return attempt;
      return {
        ...attempt,
        output: {
          ...attempt.output,
          criteria: attempt.output.criteria.filter(
            (criterion) => criterion.criterionKey !== target,
          ),
        },
        rawModelOutput: JSON.stringify({
          criteria: Object.fromEntries(
            attempt.output.criteria.map((criterion) => [
              criterion.criterionKey,
              {},
            ]),
          ),
        }),
        withdrawnCriteria: [
          { criterionKey: target, reason: 'CRITERION_MALFORMED' as const },
        ],
      };
    });

    const rates = computeRunSecurityRates({
      attempts: removedAttempts,
      observations: [],
      plan,
    });

    expect(rates.criteriaWithdrawnUndelivered.numerator).toBe(1);
    // A malformed criterion is not a provenance failure; naming them the same
    // is how two different repairs get confused for one.
    expect(rates.criteriaDroppedForEvidenceProvenance.numerator).toBe(0);
  });

  it('keeps a withdrawn criterion in the gold denominator without crediting it', async () => {
    // Neither exclusion nor credit. Dropping it from the denominator would
    // shrink the denominator when the model fails — the exact defect v6.1
    // removes — and counting it would score a level whose only support was a
    // quote the pipeline refused.
    const { baselines, mutants, plan } = await runSuite({
      behaviour: 'ATTENTIVE',
      checker: AGREEABLE_CHECKER,
    });
    const loud = computeRegressionMetrics({
      baselines,
      mutants,
      scales: plan.scales,
    });

    const withdrawnBaselines = baselines.map((observation, index) =>
      index === 0
        ? {
            ...observation,
            criteria: observation.criteria.map((criterion, position) =>
              position === 0
                ? { ...criterion, evidenceWithdrawn: true }
                : criterion,
            ),
          }
        : observation,
    );
    const withheld = computeRegressionMetrics({
      baselines: withdrawnBaselines,
      mutants,
      scales: plan.scales,
    });

    expect(loud.modelAuthoredAgreement.numerator).toBeGreaterThan(0);
    expect(withheld.modelAuthoredAgreement.denominator).toBe(
      loud.modelAuthoredAgreement.denominator,
    );
    expect(withheld.modelAuthoredAgreement.numerator).toBe(
      loud.modelAuthoredAgreement.numerator - 1,
    );
  });

  it('names a cell whose raw output cannot be read instead of counting it clean', async () => {
    const { pool, sources } = loadPool();
    const plan = planRegressionRun({
      pool,
      poolCaseIds: SAMPLE_CASE_IDS,
      sources,
    });
    const configuration = loadConfiguration(plan.corpus);
    const attempts = await runBenchmark({
      candidates: configuration.candidates.slice(0, 1),
      configuration,
      corpus: plan.corpus,
      executeCandidate: fakeExecutor({ behaviour: 'ATTENTIVE', plan }),
      providerApiKey: 'offline-test-key',
      repetitions: configuration.repetitions,
    });

    const readable = computeRunSecurityRates({
      attempts,
      observations: [],
      plan,
    });
    const blinded = attempts.map((attempt, index) =>
      index === 0 ? { ...attempt, rawModelOutput: 'not json' } : attempt,
    );
    const result = computeRunSecurityRates({
      attempts: blinded,
      observations: [],
      plan,
    });

    // An unreadable raw output cannot testify that the model wrote everything.
    // The cell leaves the denominator and is named, rather than passing quietly.
    expect(result.criteriaAbsenceUnreadableCells).toHaveLength(1);
    expect(result.criteriaAbsentFromModelOutput.denominator).toBeLessThan(
      readable.criteriaAbsentFromModelOutput.denominator,
    );
  });
});

/**
 * A run that measures one oracle must say so in its own artefact (V4.5-210).
 *
 * Otherwise a green table reads as a verdict on the system, when stability,
 * drift, the LOW share and gold agreement were never bought at all. The gates
 * that read them stay unmeasured and therefore blocking, so nothing can be
 * promoted by accident — but a reader skimming the green rows would not know
 * that, and saying it in the report is the difference between a narrow result
 * and a misread one.
 */
describe('the direction profile reports its own narrowness', () => {
  it('names what it did not buy, and what a green run does not authorise', async () => {
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
        gatePolicyVersion: '6.1.0',
        generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
        heldOutSeed: 'c'.repeat(64),
        heldOutSeedSource: 'DERIVED',
        poolId: 'learnx-fr-regression-pool-v1',
        poolSha256: 'd'.repeat(64),
        primaryIdentity: 'PROMOTED_CORRECTION_IDENTITY',
        profile: 'direction',
        repetitions: 1,
        runStartedAt: '2026-08-31T00:00:00.000Z',
      },
      metrics,
      mutantCounts: countMutantsByKind(plan),
    });

    expect(report).toContain("Ce run n'achète qu'un oracle");
    expect(report).toContain(
      'autorise à acheter la suite, jamais à promouvoir',
    );
    expect(report).toContain('stabilité');
  });

  it('says nothing of the sort on a profile that buys the pool', async () => {
    // The warning must be tied to the narrow profile, not printed always: a
    // caveat that appears on every run is one nobody reads on the run it means.
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
        gatePolicyVersion: '6.1.0',
        generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
        heldOutSeed: 'c'.repeat(64),
        heldOutSeedSource: 'DERIVED',
        poolId: 'learnx-fr-regression-pool-v1',
        poolSha256: 'd'.repeat(64),
        primaryIdentity: 'PROMOTED_CORRECTION_IDENTITY',
        profile: 'reduced',
        repetitions: 2,
        runStartedAt: '2026-08-31T00:00:00.000Z',
      },
      metrics,
      mutantCounts: countMutantsByKind(plan),
    });

    expect(report).not.toContain("Ce run n'achète qu'un oracle");
  });
});
