import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildEvidenceCertificate,
  compileExecutableRubric,
  consolidateIndependentEvidence,
  evidenceSpanFor,
  type AtomicEvidenceStatus,
  type CompiledExecutableRubric,
  type EvidencePass,
  type ExecutableRubric,
} from './executable-rubric-engine.ts';

const rubricPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
);

function loadRubric(): ExecutableRubric {
  return JSON.parse(readFileSync(rubricPath, 'utf8')) as ExecutableRubric;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('TEST_FIXTURE_MISSING');
  return value;
}

const responseText =
  "Je recommande l'option B. Le délai passe de 18 à 13 heures. Cette baisse réduit l'attente et justifie ce choix.";

function evidencePass(
  compiled: CompiledExecutableRubric,
  role: EvidencePass['role'],
  overrides: Partial<Record<string, AtomicEvidenceStatus>> = {},
): EvidencePass {
  const first = evidenceSpanFor(responseText, 0, 26);
  const secondStart = responseText.indexOf('Le délai');
  const second = evidenceSpanFor(
    responseText,
    secondStart,
    responseText.indexOf('.', secondStart) + 1,
  );
  return {
    elements: compiled.rubric.elements.map((element) => {
      const defaultStatus =
        element.polarity === 'POSITIVE' ? 'SUPPORTED' : 'NOT_DEMONSTRATED';
      const status = overrides[element.key] ?? defaultStatus;
      return {
        confidence: 0.9,
        contradictions: [],
        elementKey: element.key,
        evidenceSpans:
          status === 'SUPPORTED'
            ? element.evidenceRule.minimumSpans >= 2
              ? [first, second]
              : [first]
            : [],
        status,
      };
    }),
    pipelineFingerprint: role === 'EVIDENCE_RESEARCHER' ? 'a'.repeat(64) : 'b'.repeat(64),
    role,
  };
}

function certificateFor(
  compiled: CompiledExecutableRubric,
  researcherOverrides: Partial<Record<string, AtomicEvidenceStatus>> = {},
  falsifierOverrides: Partial<Record<string, AtomicEvidenceStatus>> = researcherOverrides,
) {
  const consolidatedEvidence = consolidateIndependentEvidence({
    compiled,
    falsifier: evidencePass(compiled, 'EVIDENCE_FALSIFIER', falsifierOverrides),
    researcher: evidencePass(compiled, 'EVIDENCE_RESEARCHER', researcherOverrides),
    responseText,
  });
  return buildEvidenceCertificate({ compiled, consolidatedEvidence });
}

describe('executable rubric compiler', () => {
  it('compiles the approved WRITING draft and reaches every authored level', () => {
    const compiled = compileExecutableRubric(loadRubric());

    expect(compiled.rubric.eligibility).toBe('FULLY_COMPILABLE');
    expect(compiled.rubric.elements).toHaveLength(9);
    expect(compiled.rubricFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejects an element that affects a criterion without explicit sharing', () => {
    const rubric = structuredClone(loadRubric());
    required(rubric.elements.at(0)).pointsByCriterion['evidence-fidelity'] = {
      CONTRADICTED: 0,
      NOT_DEMONSTRATED: 0,
      SUPPORTED: 10,
    };

    expect(() => compileExecutableRubric(rubric)).toThrow(
      'can affect only its owner and explicitly shared criteria',
    );
  });

  it('rejects a positive rule where adding valid evidence lowers points', () => {
    const rubric = structuredClone(loadRubric());
    required(
      required(rubric.elements.at(0)).pointsByCriterion['decision-position'],
    ).SUPPORTED = -10;

    expect(() => compileExecutableRubric(rubric)).toThrow(
      'can reduce decision-position when valid evidence is added',
    );
  });

  it('rejects an unreachable authored level', () => {
    const rubric = structuredClone(loadRubric());
    required(required(rubric.criteria.at(0)).levels.at(2)).minimumPoints = 101;

    expect(() => compileExecutableRubric(rubric)).toThrow(
      'decision-position/mastered cannot be reached',
    );
  });

  it('rejects a holistic element in a fully compilable rubric', () => {
    const rubric = structuredClone(loadRubric());
    required(rubric.elements.at(0)).type = 'HOLISTIC';

    expect(() => compileExecutableRubric(rubric)).toThrow(
      'is holistic and cannot belong to a fully compilable rubric',
    );
  });

  it('rejects a relation that cannot prove both sides of the relation', () => {
    const rubric = structuredClone(loadRubric());
    const relation = required(
      rubric.elements.find(({ key }) => key === 'decision-evidence-relation'),
    );
    relation.evidenceRule.minimumSpans = 1;

    expect(() => compileExecutableRubric(rubric)).toThrow(
      'must require at least two evidence spans',
    );
  });
});

describe('evidence certificate', () => {
  it('derives mastered levels, an indicative score and no progression effect', () => {
    const compiled = compileExecutableRubric(loadRubric());
    const certificate = certificateFor(compiled);

    expect(certificate.criteria.map(({ levelKey }) => levelKey)).toEqual([
      'mastered',
      'mastered',
      'mastered',
    ]);
    expect(certificate.indicativeScore).toBe(100);
    expect(certificate.correctionState).toBe('FEEDBACK_READY');
    expect(certificate.progressionEffect).toBe('NONE');
  });

  it('keeps a mutation local to its owner criterion', () => {
    const compiled = compileExecutableRubric(loadRubric());
    const certificate = certificateFor(compiled, {
      'identifiable-choice': 'NOT_DEMONSTRATED',
      'explicit-recommendation': 'NOT_DEMONSTRATED',
    });

    expect(certificate.criteria.map(({ levelKey }) => levelKey)).toEqual([
      'insufficient',
      'mastered',
      'mastered',
    ]);
    expect(certificate.correctionState).toBe('REVISION_REQUIRED');
  });

  it('withholds an exact score when an ambiguity changes a level', () => {
    const compiled = compileExecutableRubric(loadRubric());
    const certificate = certificateFor(
      compiled,
      { 'explicit-recommendation': 'SUPPORTED' },
      { 'explicit-recommendation': 'NOT_DEMONSTRATED' },
    );

    expect(required(certificate.criteria.at(0)).possibleLevelKeys).toEqual([
      'partial',
      'mastered',
    ]);
    expect(required(certificate.criteria.at(0)).levelKey).toBeNull();
    expect(certificate.indicativeScore).toBeNull();
    expect(certificate.correctionState).toBe('CLARIFICATION_REQUIRED');
  });

  it('publishes a stable level but no exact score for a non-material ambiguity', () => {
    const compiled = compileExecutableRubric(loadRubric());
    const sharedOverrides = {
      'explicit-recommendation': 'NOT_DEMONSTRATED' as const,
      'identifiable-choice': 'NOT_DEMONSTRATED' as const,
    };
    const certificate = certificateFor(
      compiled,
      sharedOverrides,
      {
        ...sharedOverrides,
        'unresolved-position-contradiction': 'SUPPORTED',
      },
    );

    expect(required(certificate.criteria.at(0)).possibleLevelKeys).toEqual(['insufficient']);
    expect(required(certificate.criteria.at(0)).levelKey).toBe('insufficient');
    expect(required(certificate.criteria.at(0)).exactPoints).toBeNull();
    expect(certificate.indicativeScore).toBeNull();
  });

  it('rejects a span that does not reconstruct the exact learner response', () => {
    const compiled = compileExecutableRubric(loadRubric());
    const researcher = evidencePass(compiled, 'EVIDENCE_RESEARCHER');
    required(required(researcher.elements.at(0)).evidenceSpans.at(0)).text =
      'Texte inventé';

    expect(() =>
      consolidateIndependentEvidence({
        compiled,
        falsifier: evidencePass(compiled, 'EVIDENCE_FALSIFIER'),
        researcher,
        responseText,
      }),
    ).toThrow('EVIDENCE_SPAN_MISMATCH');
  });

  it('rejects missing atomic coverage rather than inventing a default', () => {
    const compiled = compileExecutableRubric(loadRubric());
    const researcher = evidencePass(compiled, 'EVIDENCE_RESEARCHER');
    researcher.elements.pop();

    expect(() =>
      consolidateIndependentEvidence({
        compiled,
        falsifier: evidencePass(compiled, 'EVIDENCE_FALSIFIER'),
        researcher,
        responseText,
      }),
    ).toThrow('EVIDENCE_ELEMENT_COVERAGE_MISMATCH');
  });
});
