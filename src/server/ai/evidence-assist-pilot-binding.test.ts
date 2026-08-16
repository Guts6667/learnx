import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildEvidenceCertificate,
  compileExecutableRubric,
} from '@/lib/executable-rubric-engine.ts';
import {
  buildEvidenceAssistCandidateRubricView,
  EVIDENCE_ASSIST_PROTOCOL_VERSION,
} from '@/lib/evidence-assist-protocol.ts';

import {
  assertEvidenceAssistPilotBindingSnapshotImmutable,
  evidenceAssistPilotBindingFingerprint,
  loadEvidenceAssistPilotBinding,
  validateEvidenceAssistPilotBinding,
} from './evidence-assist-pilot-binding.ts';

const bindingPath =
  'benchmarks/ai-correction/executable-rubric/writing-go-no-go-recommendation-fr.v2.binding.json';
const rubricPath =
  'benchmarks/ai-correction/executable-rubric/writing-go-no-go-recommendation-fr.v2.json';
const specPath =
  'content/pilotage-projets-ia-iso-42001/specs/PEDAGOGY_SPEC_098.json';
const seedPath = 'seed/pilotage-projets-ia-iso-42001-program.json';

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('TEST_RECORD_REQUIRED');
  }
  return value as Record<string, unknown>;
}

function baselineBinding(): Record<string, unknown> {
  return JSON.parse(read(bindingPath)) as Record<string, unknown>;
}

function baselineArtifacts(): ReadonlyMap<string, string> {
  return new Map([
    [rubricPath, read(rubricPath)],
    [specPath, read(specPath)],
    [seedPath, read(seedPath)],
  ]);
}

function refingerprint(binding: Record<string, unknown>): void {
  binding.bindingFingerprint = evidenceAssistPilotBindingFingerprint(binding);
}

describe('draft evidence-assist pilot binding', () => {
  it('loads the anchored WRITING/fr-FR successor as candidate-only and ineligible', () => {
    const loaded = loadEvidenceAssistPilotBinding({ bindingPath });
    const candidateView = buildEvidenceAssistCandidateRubricView(
      loaded.compiledRubric,
    );

    expect(loaded.binding.lifecycle).toBe('DRAFT');
    expect(loaded.binding.protocolVersion).toBe(
      EVIDENCE_ASSIST_PROTOCOL_VERSION,
    );
    expect(loaded.binding.candidateOutcome).toEqual({
      indicativeScore: null,
      level: null,
      levelAuthority: 'NONE',
      masteryEffect: 'NONE',
      progressionEffect: 'NONE',
      scoreAuthority: 'NONE',
      semanticAuthority: 'CANDIDATE_ONLY',
    });
    expect(loaded.runtimeEligibility).toEqual({
      eligible: false,
      reasons: ['BINDING_DRAFT', 'PUBLICATION_BLOCKED'],
    });
    expect(loaded.activity).toMatchObject({
      key: 'activity-rediger-recommandation-go-no-go',
      type: 'writing',
    });
    expect(loaded.compiledRubric.rubric.elements).toHaveLength(13);
    expect(loaded.compiledRubric.rubric.eligibility).toBe(
      'EVIDENCE_ASSIST_ONLY',
    );
    expect(
      loaded.compiledRubric.rubric.elements.every(
        ({ remediation, type }) => type !== 'HOLISTIC' && Boolean(remediation),
      ),
    ).toBe(true);
    expect(candidateView.authority).toBe('CANDIDATE_ONLY');
    candidateView.elements.forEach((element) => {
      expect(Object.keys(element).sort()).toEqual([
        'acceptableVariants',
        'candidateEvidenceRule',
        'contradictionSignals',
        'counterExamples',
        'evidenceGuidance',
        'key',
        'propositionExamples',
      ]);
    });
  });

  it('rejects every attempt to derive a score or level from candidate relations', () => {
    const loaded = loadEvidenceAssistPilotBinding({ bindingPath });
    const forgedConsolidation = {
      elements: loaded.compiledRubric.rubric.elements.map(({ key }) => ({
        contradictions: [],
        elementKey: key,
        evidenceSpans: [],
        researcherConfidence: null,
        status: 'SUPPORTED' as const,
        verifierConfidence: null,
      })),
      pipelineFingerprint: 'a'.repeat(64),
    };

    expect(() =>
      buildEvidenceCertificate({
        compiled: loaded.compiledRubric,
        consolidatedEvidence: forgedConsolidation,
      }),
    ).toThrow('CANDIDATE_RELATIONS_NOT_SCORABLE');

    const scoreMutation = structuredClone(baselineBinding());
    record(scoreMutation.candidateOutcome).indicativeScore = 42;
    refingerprint(scoreMutation);
    expect(() =>
      validateEvidenceAssistPilotBinding({
        artifactTexts: baselineArtifacts(),
        binding: scoreMutation,
      }),
    ).toThrow();

    const levelMutation = structuredClone(baselineBinding());
    record(levelMutation.candidateOutcome).level = 'mastered';
    refingerprint(levelMutation);
    expect(() =>
      validateEvidenceAssistPilotBinding({
        artifactTexts: baselineArtifacts(),
        binding: levelMutation,
      }),
    ).toThrow();
  });

  it('rejects candidate-only rubric mutations that enable an indicative score', () => {
    const rubric = JSON.parse(read(rubricPath)) as Record<string, unknown>;
    record(rubric.scorePolicy).indicativeScoreEnabled = true;

    expect(() => compileExecutableRubric(rubric)).toThrow(
      'A candidate-only rubric cannot enable an indicative score.',
    );
  });

  it('rejects an altered activity or artifact path even with a recomputed fingerprint', () => {
    const targetMutation = structuredClone(baselineBinding());
    record(targetMutation.target).activityKey = 'activity-inexistante';
    refingerprint(targetMutation);
    expect(() =>
      validateEvidenceAssistPilotBinding({
        artifactTexts: baselineArtifacts(),
        binding: targetMutation,
      }),
    ).toThrow('EVIDENCE_ASSIST_BINDING_SPEC_ACTIVITY_MISSING');

    const pathMutation = structuredClone(baselineBinding());
    record(record(pathMutation.artifacts).rubric).path =
      'benchmarks/ai-correction/executable-rubric/other.json';
    refingerprint(pathMutation);
    expect(() =>
      validateEvidenceAssistPilotBinding({
        artifactTexts: baselineArtifacts(),
        binding: pathMutation,
      }),
    ).toThrow('EVIDENCE_ASSIST_BINDING_ARTIFACT_MISSING');
  });

  it('keeps a binding version immutable after its fingerprinted snapshot exists', () => {
    const previous = baselineBinding();
    const candidate = structuredClone(previous);
    record(candidate.target).activityKey = 'activity-inexistante';
    refingerprint(candidate);

    expect(() =>
      assertEvidenceAssistPilotBindingSnapshotImmutable(previous, candidate),
    ).toThrow('EVIDENCE_ASSIST_BINDING_VERSION_IMMUTABLE');
  });

  it('accepts only lifecycle DRAFT and evidence-assist protocol 3.0.0', () => {
    const lifecycleMutation = structuredClone(baselineBinding());
    lifecycleMutation.lifecycle = 'PUBLISHED';
    refingerprint(lifecycleMutation);
    expect(() =>
      validateEvidenceAssistPilotBinding({
        artifactTexts: baselineArtifacts(),
        binding: lifecycleMutation,
      }),
    ).toThrow();

    const protocolMutation = structuredClone(baselineBinding());
    protocolMutation.protocolVersion = '3.0.1';
    refingerprint(protocolMutation);
    expect(() =>
      validateEvidenceAssistPilotBinding({
        artifactTexts: baselineArtifacts(),
        binding: protocolMutation,
      }),
    ).toThrow();
  });
});
