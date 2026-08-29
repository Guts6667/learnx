import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildRegressionPool,
  collectAuthoredHints,
  derivePoolCasePrefix,
} from './ai-correction-regression-pool-build.js';
import {
  loadRegressionSource,
  parseRegressionPool,
  sha256Hex,
  validateRegressionPool,
  type LoadedRegressionSource,
  type RegressionPool,
} from './ai-correction-regression-pool.js';

/** Indexed access that fails the test loudly instead of asserting non-null. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Aucun élément à l'index ${index}.`);
  }
  return item;
}

/** The single source every fixture pool in this file is built from. */
function requireSource(
  sources: Map<string, LoadedRegressionSource>,
): LoadedRegressionSource {
  const source = sources.get(CORPUS_PATH);
  if (!source) throw new Error('Corpus source manquant.');
  return source;
}

const CORPUS_PATH = '../corpus.v1.json';

function loadCorpus(): { raw: Buffer; source: LoadedRegressionSource } {
  const raw = readFileSync(
    path.resolve('benchmarks/ai-correction/corpus.v1.json'),
  );
  return { raw, source: loadRegressionSource(raw) };
}

function buildFixture(
  hints?: Map<string, RegressionPool['cases'][number]['mutationHints']>,
): { pool: RegressionPool; sources: Map<string, LoadedRegressionSource> } {
  const { source } = loadCorpus();
  const pool = buildRegressionPool({
    generatedAt: '2026-08-29T00:00:00.000Z',
    ...(hints ? { hints } : {}),
    language: 'fr-FR',
    poolId: 'learnx-fr-regression-pool-v1',
    sources: [{ path: CORPUS_PATH, role: 'DEVELOPMENT_HISTORICAL', source }],
  });
  return { pool, sources: new Map([[CORPUS_PATH, source]]) };
}

/** Deep clone that keeps the pool a plain JSON document. */
function clone(pool: RegressionPool): RegressionPool {
  return JSON.parse(JSON.stringify(pool)) as RegressionPool;
}

describe('regression pool aggregation', () => {
  it('derives the case prefix from the corpus identifier', () => {
    expect(derivePoolCasePrefix('learnx-french-text-corpus-v1-3')).toBe(
      'corpus-v1-3',
    );
    expect(derivePoolCasePrefix('learnx-french-writing-holdout-v1')).toBe(
      'writing-holdout-v1',
    );
    expect(derivePoolCasePrefix('autre-corpus')).toBe('autre-corpus');
  });

  it('aggregates a corpus without copying or rewriting its oracle', () => {
    const { pool, sources } = buildFixture();
    const corpus = requireSource(sources).corpus;

    expect(pool.cases).toHaveLength(corpus.cases.length);
    expect(pool.sources[0]?.sha256).toBe(sha256Hex(requireSource(sources).raw));
    for (const poolCase of pool.cases) {
      // The pool never carries the learner text, only a reference to it.
      expect(poolCase).not.toHaveProperty('responseText');
      expect(poolCase.oracleKind).toBe('MODEL_AUTHORED');
      const sourceCase = corpus.cases.find(
        (candidate) => candidate.caseId === poolCase.sourceCaseId,
      );
      expect(poolCase.expectedCriteria).toEqual(sourceCase?.expectedCriteria);
    }
  });

  it('carries the attack segment of injection cases and no others', () => {
    const { pool } = buildFixture();

    for (const poolCase of pool.cases) {
      expect(poolCase.attackSegment !== undefined).toBe(
        poolCase.profile === 'PROMPT_INJECTION',
      );
    }
  });

  it('is byte-identical when rebuilt from the same corpora', () => {
    expect(JSON.stringify(buildFixture().pool)).toBe(
      JSON.stringify(buildFixture().pool),
    );
  });

  it('refuses two corpora that would share a case prefix', () => {
    const { source } = loadCorpus();

    expect(() =>
      buildRegressionPool({
        generatedAt: '2026-08-29T00:00:00.000Z',
        language: 'fr-FR',
        poolId: 'learnx-fr-regression-pool-v1',
        sources: [
          { path: CORPUS_PATH, role: 'DEVELOPMENT_HISTORICAL', source },
          { path: '../copie.json', role: 'HOLDOUT_HISTORICAL', source },
        ],
      }),
    ).toThrow('REGRESSION_POOL_CASE_PREFIX_COLLISION');
  });

  it('round-trips authored hints through a rebuild', () => {
    const caseId = 'corpus-v1-3/benchmark-writing-successful';
    const hints = new Map([
      [
        caseId,
        [
          {
            criterionKey: 'source-fact-use',
            kind: 'SENTENCE_DELETION' as const,
            sentenceIndex: 1,
          },
        ],
      ],
    ]);
    const { pool } = buildFixture(hints);

    expect(collectAuthoredHints(pool)).toEqual(hints);
  });
});

describe('regression pool validation', () => {
  it('accepts the aggregated pool', () => {
    const { pool, sources } = buildFixture();

    expect(validateRegressionPool({ pool, sources })).toEqual([]);
  });

  it('accepts the committed pool against the real corpora', () => {
    const poolPath = path.resolve(
      'benchmarks/ai-correction/regression/regression-pool.v1.json',
    );
    const pool = parseRegressionPool(
      JSON.parse(readFileSync(poolPath, 'utf8')) as unknown,
    );
    const sources = new Map(
      pool.sources.map((source) => [
        source.path,
        loadRegressionSource(
          readFileSync(path.resolve(path.dirname(poolPath), source.path)),
        ),
      ]),
    );

    expect(validateRegressionPool({ pool, sources })).toEqual([]);
    // 120 historical cases plus the 24 domain cases of V4.5-122.
    expect(pool.cases).toHaveLength(144);
    expect(pool.sources).toHaveLength(6);
  });

  it('rejects a pool whose source corpus changed under it', () => {
    const { pool, sources } = buildFixture();
    const tampered = clone(pool);
    at(tampered.sources, 0).sha256 = 'a'.repeat(64);

    expect(
      validateRegressionPool({ pool: tampered, sources }).map(
        (issue) => issue.code,
      ),
    ).toContain('SOURCE_DIGEST_MISMATCH');
  });

  it('rejects a pool that rewrites the source oracle', () => {
    const { pool, sources } = buildFixture();
    const tampered = clone(pool);
    const target = tampered.cases.find((poolCase) =>
      poolCase.expectedCriteria.some(
        (criterion) => criterion.levelKey !== 'mastered',
      ),
    );
    const criterion = target?.expectedCriteria.find(
      (candidate) => candidate.levelKey !== 'mastered',
    );
    if (!criterion) throw new Error('Aucun critère hors du niveau maximal.');
    criterion.levelKey = 'mastered';

    expect(
      validateRegressionPool({ pool: tampered, sources }).map(
        (issue) => issue.code,
      ),
    ).toContain('CASE_EXPECTED_CRITERIA_MISMATCH');
  });

  it('rejects duplicate case identifiers', () => {
    const { pool, sources } = buildFixture();
    const tampered = clone(pool);
    tampered.cases.push({ ...at(tampered.cases, 0) });

    expect(
      validateRegressionPool({ pool: tampered, sources }).map(
        (issue) => issue.code,
      ),
    ).toContain('CASE_ID_DUPLICATE');
  });

  it('rejects a case whose profile or family contradicts the source', () => {
    const { pool, sources } = buildFixture();
    const tampered = clone(pool);
    at(tampered.cases, 0).profile = 'OFF_TOPIC';
    at(tampered.cases, 1).family = 'project';

    const codes = validateRegressionPool({ pool: tampered, sources }).map(
      (issue) => issue.code,
    );
    expect(codes).toContain('CASE_PROFILE_MISMATCH');
    expect(codes).toContain('CASE_FAMILY_MISMATCH');
  });

  it('rejects a sentence hint pointing past the end of the response', () => {
    const { pool, sources } = buildFixture(
      new Map([
        [
          'corpus-v1-3/benchmark-writing-successful',
          [
            {
              criterionKey: 'source-fact-use',
              kind: 'SENTENCE_DELETION' as const,
              sentenceIndex: 99,
            },
          ],
        ],
      ]),
    );

    expect(
      validateRegressionPool({ pool, sources }).map((issue) => issue.code),
    ).toContain('HINT_SENTENCE_INDEX_OUT_OF_RANGE');
  });

  it('rejects a sentence hint that would empty a one-sentence response', () => {
    const { pool, sources } = buildFixture(
      new Map([
        [
          'corpus-v1-3/benchmark-writing-erroneous',
          [
            {
              criterionKey: 'source-fact-use',
              kind: 'SENTENCE_DELETION' as const,
              sentenceIndex: 0,
            },
          ],
        ],
      ]),
    );

    expect(
      validateRegressionPool({ pool, sources }).map((issue) => issue.code),
    ).toContain('HINT_SENTENCE_DELETION_EMPTIES_RESPONSE');
  });

  it('rejects a fact inversion whose anchor is absent or repeated', () => {
    const { pool, sources } = buildFixture(
      new Map([
        [
          'corpus-v1-3/benchmark-writing-successful',
          [
            {
              criterionKey: 'source-fact-use',
              kind: 'FACT_INVERSION' as const,
              replace: { from: 'texte totalement absent', to: 'autre' },
            },
          ],
        ],
      ]),
    );

    expect(
      validateRegressionPool({ pool, sources }).map((issue) => issue.code),
    ).toContain('HINT_FACT_INVERSION_NOT_UNIQUE');
  });

  it('rejects a fact inversion that changes nothing', () => {
    const { pool, sources } = buildFixture(
      new Map([
        [
          'corpus-v1-3/benchmark-writing-successful',
          [
            {
              criterionKey: 'source-fact-use',
              kind: 'FACT_INVERSION' as const,
              replace: { from: 'de 18 à 13 heures', to: 'de 18 à 13 heures' },
            },
          ],
        ],
      ]),
    );

    expect(
      validateRegressionPool({ pool, sources }).map((issue) => issue.code),
    ).toContain('HINT_FACT_INVERSION_NOT_A_CHANGE');
  });

  it('rejects a hint aimed at a criterion the contract does not define', () => {
    const { pool, sources } = buildFixture(
      new Map([
        [
          'corpus-v1-3/benchmark-writing-successful',
          [
            {
              criterionKey: 'critere-inconnu',
              kind: 'SENTENCE_DELETION' as const,
              sentenceIndex: 1,
            },
          ],
        ],
      ]),
    );

    expect(
      validateRegressionPool({ pool, sources }).map((issue) => issue.code),
    ).toContain('HINT_CRITERION_UNKNOWN');
  });

  it('reports every issue rather than stopping at the first', () => {
    const { pool, sources } = buildFixture();
    const tampered = clone(pool);
    at(tampered.sources, 0).sha256 = 'a'.repeat(64);
    at(tampered.cases, 0).profile = 'OFF_TOPIC';
    at(tampered.cases, 1).family = 'project';

    expect(
      validateRegressionPool({ pool: tampered, sources }).length,
    ).toBeGreaterThanOrEqual(3);
  });
});
