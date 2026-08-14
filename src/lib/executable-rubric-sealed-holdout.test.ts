import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import {
  executableRubricHoldoutManifestSchema,
  openExecutableRubricHoldout,
  sealExecutableRubricHoldout,
  serializeSealedHoldoutArtifact,
  validateExecutableRubricHoldoutPlaintext,
} from './executable-rubric-sealed-holdout.ts';

const directory = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric',
);
const compiled = compileExecutableRubric(
  JSON.parse(
    readFileSync(resolve(directory, 'writing-recommendation-fr.v1.json'), 'utf8'),
  ) as unknown,
);

function readManifest(): unknown {
  return JSON.parse(
    readFileSync(resolve(directory, 'writing-fr-holdout.v2.manifest.json'), 'utf8'),
  ) as unknown;
}

function approvedPlaintext(): unknown {
  const elements = compiled.rubric.elements.map(({ key }) => ({
    elementKey: key,
    evidenceQuotes:
      key === 'identifiable-choice' ? ['Je recommande les deux ordinateurs.'] : [],
    status: key === 'identifiable-choice' ? 'SUPPORTED' : 'NOT_DEMONSTRATED',
  }));
  return {
    schemaVersion: 2,
    holdoutId: 'writing-fr-executable-rubric-holdout-v2',
    holdoutVersion: '2.0.0',
    language: 'fr-FR',
    modality: 'WRITING',
    rubric: {
      key: compiled.rubric.rubricKey,
      version: compiled.rubric.rubricVersion,
      fingerprint: compiled.rubricFingerprint,
    },
    humanReview: {
      status: 'APPROVED',
      reviewer: 'Independent reviewer fixture',
      reviewedAt: '2026-08-14T09:00:00.000Z',
    },
    cases: Array.from({ length: 24 }, (_, index) => ({
      caseId: `sealed-test-${index + 1}`,
      taskContext: 'Contexte synthétique de test.',
      taskPrompt: 'Recommandez une option.',
      responseText: 'Je recommande les deux ordinateurs.',
      evidencePasses: [
        {
          role: 'EVIDENCE_RESEARCHER',
          elements,
        },
      ],
    })),
  };
}

describe('executable rubric sealed holdout', () => {
  it('keeps the repository manifest empty, unsealed and non-executable', () => {
    const manifest = executableRubricHoldoutManifestSchema.parse(readManifest());
    const raw = JSON.stringify(manifest);

    expect(manifest.status).toBe('CONTENT_NOT_AUTHORED');
    expect(manifest.caseCount).toBe(0);
    expect(manifest.sealed).toBe(false);
    expect(manifest.executable).toBe(false);
    expect(manifest.review.status).toBe('PENDING_INDEPENDENT_HUMAN_REVIEW');
    expect(raw).not.toContain('responseText');
    expect(raw).not.toContain('expectedElements');
    expect(raw).not.toContain('cases');
  });

  it('rejects a manifest that claims sealing without review or ciphertext', () => {
    const manifest = structuredClone(readManifest()) as Record<string, unknown>;
    manifest['sealed'] = true;
    manifest['status'] = 'SEALED_AWAITING_DEVELOPMENT_GO';

    expect(() => executableRubricHoldoutManifestSchema.parse(manifest)).toThrow();
  });

  it('validates, encrypts and decrypts an independently approved external bundle', () => {
    const plaintext = validateExecutableRubricHoldoutPlaintext({
      compiled,
      plaintext: approvedPlaintext(),
    });
    const key = Buffer.alloc(32, 7);
    const sealed = sealExecutableRubricHoldout({
      iv: Buffer.alloc(12, 3),
      key,
      manifest: readManifest(),
      plaintext,
    });
    const opened = openExecutableRubricHoldout({
      envelope: sealed.envelope,
      key,
    });

    expect(opened).toEqual(plaintext);
    expect(sealed.manifest.status).toBe('SEALED_AWAITING_DEVELOPMENT_GO');
    expect(sealed.manifest.sealed).toBe(true);
    expect(sealed.manifest.executable).toBe(false);
    expect(sealed.manifest.caseCount).toBe(24);
    expect(sealed.artifactSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(serializeSealedHoldoutArtifact(sealed.envelope)).not.toContain(
      'Je recommande les deux ordinateurs.',
    );
  });

  it('rejects evidence outside the learner response before sealing', () => {
    const plaintext = approvedPlaintext() as {
      cases: Array<{
        evidencePasses: Array<{
          elements: Array<{ evidenceQuotes: string[] }>;
        }>;
      }>;
    };
    const firstCase = plaintext.cases.at(0);
    const firstPass = firstCase?.evidencePasses.at(0);
    const firstElement = firstPass?.elements.at(0);
    if (!firstElement) throw new Error('TEST_FIXTURE_MISSING');
    firstElement.evidenceQuotes = ['citation absente'];

    expect(() =>
      validateExecutableRubricHoldoutPlaintext({ compiled, plaintext }),
    ).toThrow('SEALED_HOLDOUT_QUOTE_NOT_IN_RESPONSE');
  });

  it('rejects two identical spans used to satisfy a relation cardinality', () => {
    const plaintext = approvedPlaintext() as {
      cases: Array<{
        evidencePasses: Array<{
          elements: Array<{
            elementKey: string;
            evidenceQuotes: string[];
            status: string;
          }>;
        }>;
      }>;
    };
    const firstCase = plaintext.cases.at(0);
    const firstPass = firstCase?.evidencePasses.at(0);
    const relation = firstPass?.elements.find(
      ({ elementKey }) => elementKey === 'decision-evidence-relation',
    );
    if (!relation) throw new Error('TEST_FIXTURE_MISSING');
    relation.status = 'SUPPORTED';
    relation.evidenceQuotes = [
      'Je recommande les deux ordinateurs.',
      'Je recommande les deux ordinateurs.',
    ];

    expect(() =>
      validateExecutableRubricHoldoutPlaintext({ compiled, plaintext }),
    ).toThrow('EVIDENCE_SPAN_DUPLICATE');
  });
});
