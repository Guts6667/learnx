import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeRegressionMetrics } from './ai-correction-regression-metrics.js';
import { REGRESSION_MUTANT_GENERATOR_VERSION } from './ai-correction-regression-mutants.js';
import { generateRegressionMutants } from './ai-correction-regression-mutants.js';
import {
  checkParaphraseCacheEntry,
  generateParaphraseCacheEntry,
  paraphraseCachePath,
  parseParaphraseCacheEntry,
  responseDigest,
  type ParaphraseCacheEntry,
  type ParaphrasePort,
} from './ai-correction-regression-paraphrase.js';
import {
  loadParaphraseCache,
  parseSupplierCostCap,
  RegressionRunError,
  renderLedger,
  selectPinnedCandidate,
} from './ai-correction-regression-run-cli.js';
import type { RegressionPoolCase } from './ai-correction-regression-pool.js';

const RESPONSE =
  'Je recommande le pilote étendu. Le délai est passé de 18 à 13 heures.';
const PARAPHRASE =
  'Je préconise le pilote élargi. Le délai a chuté de 18 à 13 heures.';
const POOL_ID = 'learnx-fr-regression-pool-v1';
const CASE_ID = 'corpus-v1-3/benchmark-writing-successful';

function entry(
  overrides: Partial<ParaphraseCacheEntry> = {},
): ParaphraseCacheEntry {
  return parseParaphraseCacheEntry({
    caseId: CASE_ID,
    checkerModelId: 'mistralai/mistral-medium-3-5',
    generatedAt: '2026-08-29T00:00:00.000Z',
    generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
    paraphraseText: PARAPHRASE,
    poolId: POOL_ID,
    schemaVersion: 1,
    sourceResponseSha256: responseDigest(RESPONSE),
    verifiedSameMeaning: true,
    ...overrides,
  });
}

function poolCase(): RegressionPoolCase {
  return {
    caseId: CASE_ID,
    contractRef: {
      contractKey: 'french-text',
      contractVersion: '1.0.0',
      path: '../corpus.v1.json',
    },
    expectedCriteria: [
      { criterionKey: 'source-fact-use', levelKey: 'mastered' },
    ],
    family: 'writing',
    mutationHints: [],
    oracleKind: 'MODEL_AUTHORED',
    profile: 'SUCCESSFUL',
    sourceCaseId: 'benchmark-writing-successful',
    sourcePath: '../corpus.v1.json',
  };
}

describe('paraphrase cache freshness', () => {
  it('accepts an entry that still matches its source', () => {
    expect(
      checkParaphraseCacheEntry({
        caseId: CASE_ID,
        entry: entry(),
        poolId: POOL_ID,
        responseText: RESPONSE,
      }),
    ).toEqual({ usable: true });
  });

  it('refuses an entry whose source response has changed', () => {
    const verdict = checkParaphraseCacheEntry({
      caseId: CASE_ID,
      entry: entry(),
      poolId: POOL_ID,
      responseText: `${RESPONSE} Une phrase de plus.`,
    });

    expect(verdict.usable).toBe(false);
    expect(verdict.usable === false && verdict.reason).toContain('changé');
  });

  it('refuses an entry produced by another generator version', () => {
    expect(
      checkParaphraseCacheEntry({
        caseId: CASE_ID,
        entry: entry({ generatorVersion: '9.9.9' }),
        poolId: POOL_ID,
        responseText: RESPONSE,
      }).usable,
    ).toBe(false);
  });

  it('refuses an entry belonging to another pool version', () => {
    // The cache is frozen per pool version so two promotions stay comparable
    // on the one oracle whose input is itself a model output.
    expect(
      checkParaphraseCacheEntry({
        caseId: CASE_ID,
        entry: entry({ poolId: 'learnx-fr-regression-pool-v2' }),
        poolId: POOL_ID,
        responseText: RESPONSE,
      }).usable,
    ).toBe(false);
  });

  it('refuses a paraphrase identical to the response', () => {
    expect(
      checkParaphraseCacheEntry({
        caseId: CASE_ID,
        entry: entry({ paraphraseText: RESPONSE }),
        poolId: POOL_ID,
        responseText: RESPONSE,
      }).usable,
    ).toBe(false);
  });

  it('nests the cache under the pool version', () => {
    expect(paraphraseCachePath({ caseId: CASE_ID, poolId: POOL_ID })).toBe(
      `paraphrases/${POOL_ID}/${CASE_ID}.json`,
    );
  });
});

describe('paraphrase generation', () => {
  const port = (overrides: Partial<ParaphrasePort> = {}): ParaphrasePort => ({
    confirmSameMeaning: async () => true,
    paraphrase: async () => ({
      modelId: 'mistralai/mistral-medium-3-5',
      paraphraseText: PARAPHRASE,
    }),
    ...overrides,
  });

  it('writes an entry only after the verifier confirms the meaning', async () => {
    const outcome = await generateParaphraseCacheEntry({
      caseId: CASE_ID,
      generatedAt: '2026-08-29T00:00:00.000Z',
      poolId: POOL_ID,
      port: port(),
      responseText: RESPONSE,
    });

    expect(outcome.status).toBe('GENERATED');
    expect(
      outcome.status === 'GENERATED' && outcome.entry.verifiedSameMeaning,
    ).toBe(true);
    expect(
      outcome.status === 'GENERATED' && outcome.entry.sourceResponseSha256,
    ).toBe(responseDigest(RESPONSE));
  });

  it('drops a rewrite the verifier will not confirm', async () => {
    const outcome = await generateParaphraseCacheEntry({
      caseId: CASE_ID,
      generatedAt: '2026-08-29T00:00:00.000Z',
      poolId: POOL_ID,
      port: port({ confirmSameMeaning: async () => false }),
      responseText: RESPONSE,
    });

    // Fewer mutants beats one whose premise nobody checked.
    expect(outcome.status).toBe('REJECTED');
  });

  it('drops a rewrite that changed nothing', async () => {
    const outcome = await generateParaphraseCacheEntry({
      caseId: CASE_ID,
      generatedAt: '2026-08-29T00:00:00.000Z',
      poolId: POOL_ID,
      port: port({
        paraphrase: async () => ({
          modelId: 'mistralai/mistral-medium-3-5',
          paraphraseText: RESPONSE,
        }),
      }),
      responseText: RESPONSE,
    });

    expect(outcome.status).toBe('REJECTED');
  });
});

describe('PARAPHRASE mutants', () => {
  it('emits nothing when the case has no cached paraphrase', () => {
    const mutants = generateRegressionMutants({
      canonicalAttackSegment: 'Attaque canonique.',
      locale: 'fr-FR',
      poolCase: poolCase(),
      responseText: RESPONSE,
    });

    expect(mutants.some((mutant) => mutant.kind === 'PARAPHRASE')).toBe(false);
  });

  it('emits a within-one-step mutant from a cached paraphrase', () => {
    const mutants = generateRegressionMutants({
      canonicalAttackSegment: 'Attaque canonique.',
      locale: 'fr-FR',
      paraphraseText: PARAPHRASE,
      poolCase: poolCase(),
      responseText: RESPONSE,
    });
    const paraphrase = mutants.find((mutant) => mutant.kind === 'PARAPHRASE');

    expect(paraphrase?.responseText).toBe(PARAPHRASE);
    expect(paraphrase?.expectation).toEqual({
      othersExpectation: 'WITHIN_ONE_STEP',
    });
  });
});

describe('PARAPHRASE in the drift metric', () => {
  it('counts an unrelated criterion that moved more than one step', () => {
    const scale = {
      caseId: CASE_ID,
      criteria: [
        {
          criterionKey: 'source-fact-use',
          orderedLevelKeys: ['insufficient', 'partial', 'mastered'],
        },
      ],
      expectedCriteria: [
        { criterionKey: 'source-fact-use', levelKey: 'mastered' },
      ],
    };
    const criterion = (levelKey: string) => ({
      checkerVerdict: 'AGREED' as const,
      confidence: 'HIGH' as const,
      criterionKey: 'source-fact-use',
      levelKey,
    });

    const metrics = computeRegressionMetrics({
      baselines: [
        { caseId: CASE_ID, criteria: [criterion('mastered')], repetition: 1 },
      ],
      mutants: [
        {
          caseId: CASE_ID,
          criteria: [criterion('insufficient')],
          expectation: { othersExpectation: 'WITHIN_ONE_STEP' },
          kind: 'PARAPHRASE',
          mutantId: 'm-paraphrase',
          repetition: 1,
        },
      ],
      scales: [scale],
    });

    // Same meaning, different wording: a two-step fall is drift, and the
    // paraphrase oracle has to contribute it like the other stable kinds.
    expect(metrics.unrelatedCriterionDrift.numerator).toBe(1);
    expect(metrics.unrelatedCriterionDrift.denominator).toBe(1);
  });
});

describe('paraphrase cache loading', () => {
  it('is silent about a missing entry and loud about a stale one', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'regression-cache-'));
    const stalePath = path.join(
      directory,
      paraphraseCachePath({ caseId: 'pool/perime', poolId: POOL_ID }),
    );
    await mkdir(path.dirname(stalePath), { recursive: true });
    await writeFile(
      stalePath,
      JSON.stringify(entry({ caseId: 'pool/perime' })),
      'utf8',
    );

    const load = await loadParaphraseCache({
      caseIds: ['pool/perime', 'pool/absent'],
      poolId: POOL_ID,
      regressionDirectory: directory,
      responseTextByCaseId: new Map([
        ['pool/perime', 'Un texte qui a changé depuis la mise en cache.'],
        ['pool/absent', RESPONSE],
      ]),
    });

    expect(load.paraphrases.size).toBe(0);
    expect(load.refusals).toHaveLength(1);
    expect(load.refusals[0]?.caseId).toBe('pool/perime');
  });
});

describe('run guards', () => {
  const configuration = {
    candidates: [
      {
        candidateId: 'claude-sonnet-4-6-openrouter-anthropic',
        modelId: 'anthropic/claude-sonnet-4.6',
      },
      { candidateId: 'autre-modele', modelId: 'openai/gpt-5.6-terra' },
    ],
  } as never;
  const identities = {
    checkerModelId: 'mistralai/mistral-medium-3-5',
    maxRetries: 0,
    primaryCandidateId: 'claude-sonnet-4-6-openrouter-anthropic',
    primaryModelId: 'anthropic/claude-sonnet-4.6',
  };

  it('selects the promoted candidate', () => {
    expect(
      selectPinnedCandidate({ configuration, identities }).candidateId,
    ).toBe('claude-sonnet-4-6-openrouter-anthropic');
  });

  it('refuses a configuration without the promoted identity', () => {
    expect(() =>
      selectPinnedCandidate({
        configuration,
        identities: { ...identities, primaryCandidateId: 'inconnu' },
      }),
    ).toThrow(RegressionRunError);
  });

  it('refuses a candidate whose model was swapped underneath it', () => {
    // A run that measured a different model cannot be evidence for promoting
    // this one, so the mismatch is an error rather than a warning.
    expect(() =>
      selectPinnedCandidate({
        configuration,
        identities: { ...identities, primaryModelId: 'anthropic/claude-4.0' },
      }),
    ).toThrow(/IDENTITY_MISMATCH/);
  });

  it('requires an explicit supplier cost cap', () => {
    expect(() => parseSupplierCostCap([])).toThrow(/COST_CAP_REQUIRED/);
    expect(() => parseSupplierCostCap(['--supplier-cost-cap-usd=0'])).toThrow(
      /COST_CAP_INVALID/,
    );
    expect(parseSupplierCostCap(['--supplier-cost-cap-usd=3'])).toBe(3);
  });

  it('renders one ledger line per attempt', () => {
    const ledger = renderLedger([
      {
        attempt: 1,
        candidateId: 'candidat',
        caseId: 'cas',
        latencyMs: 10,
        modelId: 'modele',
        repetition: 1,
        requestProfileSnapshot: {},
        requestProtocolVersion: '3.0.1',
        status: 'VALID',
        usage: { actualCostUsd: 0.01, costSource: 'ACTUAL' },
      },
    ] as never);

    const lines = ledger.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      caseId: 'cas',
      costSource: 'ACTUAL',
      costUsd: 0.01,
      status: 'VALID',
    });
  });
});
