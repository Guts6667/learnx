import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCorrectionBenchmarkCorpus } from './ai-correction-benchmark.js';
import {
  buildArchetypeContract,
  buildDomainCorpus,
  DomainCorpusError,
  parseAuthoredDomainCorpus,
  weightedScore,
  type AuthoredDomainCorpus,
} from './ai-correction-regression-domain-build.js';
import { segmentParagraphs } from './ai-correction-regression-text.js';

const AUTHORED_PATH = path.resolve(
  'benchmarks/ai-correction/domain/authored-cases.v1.json',
);

function authored(): AuthoredDomainCorpus {
  return parseAuthoredDomainCorpus(
    JSON.parse(readFileSync(AUTHORED_PATH, 'utf8')) as unknown,
  );
}

function clone(source: AuthoredDomainCorpus): AuthoredDomainCorpus {
  return JSON.parse(JSON.stringify(source)) as AuthoredDomainCorpus;
}

describe('domain corpus compiled from real archetypes', () => {
  it('produces a schema-valid corpus of 24 cases over 4 archetypes', () => {
    const { corpus } = buildDomainCorpus(authored());

    expect(() => parseCorrectionBenchmarkCorpus(corpus)).not.toThrow();
    expect(corpus.cases).toHaveLength(24);
    expect(corpus.contracts).toHaveLength(4);
    expect(corpus.syntheticOnly).toBe(true);
  });

  it('covers all four productive families and all six response profiles', () => {
    const { corpus } = buildDomainCorpus(authored());
    const families = new Set(
      corpus.contracts.map((contract) => contract.target.activityType),
    );
    const profiles = new Set(
      corpus.cases.map((benchmarkCase) => benchmarkCase.category),
    );

    expect([...families].sort()).toEqual([
      'practice',
      'project',
      'reflection',
      'writing',
    ]);
    expect([...profiles].sort()).toEqual([
      'AMBIGUOUS',
      'ERRONEOUS',
      'OFF_TOPIC',
      'PARTIAL',
      'PROMPT_INJECTION',
      'SUCCESSFUL',
    ]);
  });

  it('takes its contracts from the production archetype builder', () => {
    const source = authored();
    const { corpus } = buildDomainCorpus(source);

    for (const archetype of source.archetypes) {
      const expected = buildArchetypeContract(archetype);
      const compiled = corpus.contracts.find(
        (contract) => contract.contractKey === expected.contractKey,
      );
      // Identical fingerprints: change the archetype and this corpus follows,
      // rather than testing a copy that has quietly drifted from production.
      expect(compiled).toBeDefined();
      expect(compiled?.criteria.map((criterion) => criterion.key)).toEqual(
        expected.criteria.map((criterion) => criterion.key),
      );
    }
  });

  it('gives every response at least two paragraphs', () => {
    const { corpus } = buildDomainCorpus(authored());

    for (const benchmarkCase of corpus.cases) {
      // The reason V4.5-122 exists in this shape: the v1 pool was entirely
      // single-paragraph, so PARAGRAPH_SHUFFLE had nothing to permute.
      expect(
        segmentParagraphs(benchmarkCase.responseText).paragraphs.length,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('derives the second-pass expectation from the weighted score', () => {
    const source = authored();
    const { corpus } = buildDomainCorpus(source);

    for (const benchmarkCase of corpus.cases) {
      const contract = corpus.contracts.find(
        (candidate) =>
          candidate.contractKey === benchmarkCase.contractKey &&
          candidate.version === benchmarkCase.contractVersion,
      );
      const score = weightedScore({
        contract: contract as NonNullable<typeof contract>,
        levels: Object.fromEntries(
          benchmarkCase.expectedCriteria.map((criterion) => [
            criterion.criterionKey,
            criterion.levelKey,
          ]),
        ),
      });
      const expected = Math.abs(score - (contract?.passingScore ?? 0)) <= 5;
      expect(benchmarkCase.expectedSecondPass.required).toBe(expected);
    }
  });

  it('derives injection response text as legitimate plus attack', () => {
    const source = authored();
    const { corpus } = buildDomainCorpus(source);

    for (const benchmarkCase of corpus.cases) {
      if (benchmarkCase.category !== 'PROMPT_INJECTION') {
        expect(benchmarkCase.injectionSecurity).toBeUndefined();
        continue;
      }
      const security = benchmarkCase.injectionSecurity;
      expect(benchmarkCase.responseText).toBe(
        `${security?.legitimateResponseText} ${security?.attackText}`,
      );
      for (const quote of security?.allowedEvidenceQuotes ?? []) {
        expect(security?.legitimateResponseText).toContain(quote);
      }
    }
  });

  it('resolves sentence hints from anchors rather than authored indices', () => {
    const source = authored();
    const { hints } = buildDomainCorpus(source);
    const authoredCase = source.cases.find(
      (candidate) => candidate.caseId === 'domaine-ecrit-objectif-complet',
    );
    const resolved = hints.get('domaine-ecrit-objectif-complet');

    expect(authoredCase?.mutationHints).toHaveLength(3);
    expect(resolved).toHaveLength(3);
    for (const hint of resolved ?? []) {
      if (hint.kind !== 'SENTENCE_DELETION') continue;
      expect(hint.sentenceIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('refuses an anchor that does not name exactly one sentence', () => {
    const source = clone(authored());
    const target = source.cases.find(
      (candidate) => candidate.caseId === 'domaine-ecrit-objectif-complet',
    );
    target?.mutationHints.push({
      criterionKey: 'context-fidelity',
      kind: 'SENTENCE_DELETION',
      sentenceAnchor: 'phrase absente de la réponse',
    });

    // Silently dropping it would leave the pool one oracle short with no sign.
    expect(() => buildDomainCorpus(source)).toThrow(DomainCorpusError);
  });

  it('refuses a hint aimed at a criterion the archetype does not define', () => {
    const source = clone(authored());
    const target = source.cases.find(
      (candidate) => candidate.caseId === 'domaine-pratique-update-complet',
    );
    target?.mutationHints.push({
      criterionKey: 'written-reasoning',
      kind: 'FACT_INVERSION',
      replace: { from: 'Sprint Goal', to: 'Objectif' },
    });

    // `written-reasoning` belongs to the writing archetype, not to practice.
    expect(() => buildDomainCorpus(source)).toThrow(/CRITERION_UNKNOWN/);
  });

  it('refuses a case whose expected level is missing or unknown', () => {
    const source = clone(authored());
    const target = source.cases.find(
      (candidate) => candidate.caseId === 'domaine-projet-worker-complet',
    );
    if (target) delete target.expectedLevels['project-coherence'];

    expect(() => buildDomainCorpus(source)).toThrow(/LEVEL_MISSING/);
  });

  it('carries no personal data and no real learner identity', () => {
    const { corpus } = buildDomainCorpus(authored());
    const text = JSON.stringify(corpus);

    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    // French and international phone shapes specifically. A looser "digits and
    // punctuation" pattern flags ISO dates and lesson numbering, which would
    // make the check noise rather than a guard.
    expect(text).not.toMatch(/\b0\d(?:[ .-]?\d{2}){4}\b/);
    expect(text).not.toMatch(/\+\d{1,3}[ .-]?\d(?:[ .-]?\d{2}){4}\b/);
    expect(text).not.toMatch(/\b\d{1,3}(?:[ .]\d{3}){2,}\b/);
    for (const benchmarkCase of corpus.cases) {
      expect(benchmarkCase.taskContext).toContain('fictif');
    }
  });
});
