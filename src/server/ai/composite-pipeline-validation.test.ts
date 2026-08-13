import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CorrectionContract } from '@/lib/ai-correction-contracts';

import type { RoleObservation } from './composite-correction.js';
import {
  V4_009B_PANEL_CASE_IDS,
  assertCompositeRunCallAllowed,
  assertFrozenCompositeRunEnvelope,
  buildCompositePanelCells,
  createBlindReviewEntry,
  createBlindReviewMapping,
  createCompositeRunEnvelopeFingerprint,
  classifyV4009BDisagreement,
  deriveV4009BTriggerReasons,
  type CompositeRunEnvelope,
} from './composite-pipeline-validation.js';

const contract = {
  authorizedReferences: [],
  contractKey: 'panel-contract',
  criteria: ['first', 'second'].map((key) => ({
    acceptableVariants: [],
    calibratedExamples: [],
    commonErrors: [],
    expectedElements: ['Élément attendu'],
    key,
    label: key,
    objective: `Évaluer ${key}`,
    performanceLevels: [
      {
        description: 'Absent',
        key: 'insufficient',
        label: 'Insuffisant',
        score: 0,
      },
      { description: 'Partiel', key: 'partial', label: 'Partiel', score: 50 },
      {
        description: 'Maîtrisé',
        key: 'mastered',
        label: 'Maîtrisé',
        score: 100,
      },
    ],
    weight: 50,
  })),
  evidence: { acceptedKinds: ['TEXT'], primaryKind: 'TEXT' },
  lifecycle: { publishedAt: '2026-08-13T00:00:00.000Z', status: 'PUBLISHED' },
  objectives: ['Objectif'],
  passingScore: 75,
  schemaVersion: 1,
  secondPass: {
    confidenceThreshold: 0.65,
    enabled: true,
    maxPasses: 2,
    triggers: ['CRITERION_DISAGREEMENT'],
  },
  target: {
    activityKey: 'panel-activity',
    activityType: 'writing',
    kind: 'EXERCISE',
  },
  version: '1.0.0',
} satisfies CorrectionContract;

function observation(first: string, second: string): RoleObservation {
  return {
    criteria: [
      {
        confidence: 0.9,
        criterionKey: 'first',
        evidenceQuotes: ['A'],
        feedback: 'A',
        levelKey: first,
      },
      {
        confidence: 0.9,
        criterionKey: 'second',
        evidenceQuotes: ['B'],
        feedback: 'B',
        levelKey: second,
      },
    ],
    overallFeedback: 'Retour',
  };
}

const digests = Object.fromEntries(
  V4_009B_PANEL_CASE_IDS.map((caseId, index) => [
    caseId,
    index.toString(16).padStart(64, '0'),
  ]),
) as Record<(typeof V4_009B_PANEL_CASE_IDS)[number], string>;

function envelope(
  overrides: Partial<CompositeRunEnvelope> = {},
): CompositeRunEnvelope {
  return {
    authorization: 'GRANTED',
    budget: {
      absoluteCampaignMaximumProviderCalls: 48,
      expectedWithoutRetryUsd: 0.35,
      maximumInitialVerifierCalls: 10,
      maximumProviderCalls: 44,
      maximumTechnicalRetriesPerRoleAndCell: 1,
      maximumUsageCostUsd: 0.75,
      status: 'ARBITRATED',
    },
    cells: buildCompositePanelCells(digests),
    corpusId: 'learnx-french-text-corpus-v1-3',
    corpusSha256: 'a'.repeat(64),
    identity: {
      primary: { modelId: 'mistralai/mistral-medium-3-5' },
      verifier: { modelId: 'anthropic/claude-sonnet-4.6' },
    },
    panelVersion: '1.0.0',
    repetitions: 2,
    status: 'FROZEN',
    ...overrides,
  };
}

describe('V4-009B composite validation envelope', () => {
  it('loads the frozen manifest but keeps every live call owner-gated', () => {
    const manifestPath = resolve(
      'benchmarks/ai-correction/composite/v4-009b-run-envelope.json',
    );
    const manifestBytes = readFileSync(manifestPath);
    const manifest = JSON.parse(
      manifestBytes.toString('utf8'),
    ) as CompositeRunEnvelope;
    const recordedHashes = readFileSync(
      resolve('benchmarks/ai-correction/composite/v4-009b-run-envelope.sha256'),
      'utf8',
    );
    expect(() => assertFrozenCompositeRunEnvelope(manifest)).not.toThrow();
    expect(recordedHashes).toContain(
      createHash('sha256').update(manifestBytes).digest('hex'),
    );
    expect(recordedHashes).toContain(
      createCompositeRunEnvelopeFingerprint(manifest),
    );
    expect(manifest.authorization).toBe('OWNER_GO_REQUIRED');
    expect(
      (
        manifest as CompositeRunEnvelope & {
          conditionalFullCampaign: {
            holdoutStatus: string;
            maximumProviderCalls: number;
            maximumUsageCostUsd: number;
            remainingPrimaryCellsAfterMiniPanel: number;
            status: string;
          };
        }
      ).conditionalFullCampaign,
    ).toMatchObject({
      holdoutStatus: 'CLOSED',
      maximumProviderCalls: 180,
      maximumUsageCostUsd: 2,
      remainingPrimaryCellsAfterMiniPanel: 60,
      status: 'BLOCKED_PENDING_MINI_PANEL_REVIEW_AND_OWNER_GO',
    });
    expect((manifest.identity as { pipelineId: string }).pipelineId).toBe(
      'learnx-fr-text-mistral-sonnet-targeted-v1',
    );
    expect(
      (
        manifest.identity as {
          trigger: { controlSampleCellKeys: readonly string[] };
        }
      ).trigger.controlSampleCellKeys,
    ).toEqual([
      'benchmark-writing-successful:1',
      'benchmark-practice-erroneous:1',
    ]);
  });

  it('pre-registers exactly six cases and two repetitions', () => {
    const cells = buildCompositePanelCells(digests);
    expect(cells).toHaveLength(12);
    expect(new Set(cells.map((cell) => cell.caseId))).toEqual(
      new Set(V4_009B_PANEL_CASE_IDS),
    );
    expect(cells.filter((cell) => cell.repetition === 1)).toHaveLength(6);
    expect(cells.filter((cell) => cell.repetition === 2)).toHaveLength(6);
    expect(() => assertFrozenCompositeRunEnvelope(envelope())).not.toThrow();
  });

  it('refuses a draft, duplicate cells and an invalid budget', () => {
    expect(() =>
      assertFrozenCompositeRunEnvelope(envelope({ status: 'DRAFT' })),
    ).toThrow('COMPOSITE_RUN_ENVELOPE_NOT_FROZEN');
    const cells = buildCompositePanelCells(digests);
    const firstCell = cells[0];
    if (!firstCell) throw new Error('PANEL_FIXTURE_EMPTY');
    expect(() =>
      assertFrozenCompositeRunEnvelope(
        envelope({ cells: [...cells.slice(0, 11), firstCell] }),
      ),
    ).toThrow('COMPOSITE_RUN_PANEL_INVALID');
    expect(() =>
      assertFrozenCompositeRunEnvelope(
        envelope({
          budget: {
            absoluteCampaignMaximumProviderCalls: 48,
            expectedWithoutRetryUsd: 0.8,
            maximumInitialVerifierCalls: 10,
            maximumProviderCalls: 44,
            maximumTechnicalRetriesPerRoleAndCell: 1,
            maximumUsageCostUsd: 0.75,
            status: 'ARBITRATED',
          },
        }),
      ),
    ).toThrow('COMPOSITE_RUN_BUDGET_INVALID');
  });

  it('changes the identity fingerprint on every frozen rule mutation', () => {
    const original = envelope();
    expect(createCompositeRunEnvelopeFingerprint(original)).not.toBe(
      createCompositeRunEnvelopeFingerprint({
        ...original,
        identity: { ...(original.identity as object), triggerVersion: '1.0.1' },
      }),
    );
  });

  it('stops before an extra call can exceed calls or provider cost', () => {
    expect(() =>
      assertCompositeRunCallAllowed({
        envelope: envelope(),
        estimatedWorstCaseNextCallUsd: 0.02,
        progress: {
          completedCellKeys: [],
          providerCalls: 43,
          reservedInFlightUsd: 0,
          usageCostUsd: 0.74,
        },
      }),
    ).toThrow('BUDGET_CAP_PREVENTED_CALL');
    expect(() =>
      assertCompositeRunCallAllowed({
        envelope: envelope(),
        estimatedWorstCaseNextCallUsd: 0.01,
        progress: {
          completedCellKeys: [],
          providerCalls: 44,
          reservedInFlightUsd: 0,
          usageCostUsd: 0.4,
        },
      }),
    ).toThrow('ATTEMPT_CAP_REACHED');
    expect(() =>
      assertCompositeRunCallAllowed({
        envelope: envelope({ authorization: 'OWNER_GO_REQUIRED' }),
        estimatedWorstCaseNextCallUsd: 0.01,
        progress: {
          completedCellKeys: [],
          providerCalls: 0,
          reservedInFlightUsd: 0,
          usageCostUsd: 0,
        },
      }),
    ).toThrow('COMPOSITE_RUN_OWNER_GO_REQUIRED');
  });

  it('derives the versioned trigger without using self-confidence alone', () => {
    const primary = observation('partial', 'partial');
    expect(
      deriveV4009BTriggerReasons({
        contract,
        controlSample: false,
        deterministicSecurityReview: false,
        primary,
        usableValidationWarning: false,
      }),
    ).toEqual(['DECISION_SENSITIVE']);
    expect(
      deriveV4009BTriggerReasons({
        contract,
        controlSample: true,
        deterministicSecurityReview: false,
        primary: observation('insufficient', 'insufficient'),
        usableValidationWarning: false,
      }),
    ).toEqual(['CONTROL_SAMPLE']);
    expect(
      deriveV4009BTriggerReasons({
        contract,
        controlSample: true,
        deterministicSecurityReview: true,
        primary: observation('insufficient', 'insufficient'),
        usableValidationWarning: false,
      }),
    ).toEqual(['SECURITY_REVIEW']);
  });

  it('classifies exact, adjacent and material disagreements without averaging', () => {
    const primary = observation('mastered', 'mastered');
    expect(
      classifyV4009BDisagreement({
        contract,
        hasEvidenceOrSecurityConflict: false,
        primary,
        verifier: observation('mastered', 'mastered'),
      }),
    ).toBe('EXACT_AGREEMENT');
    expect(
      classifyV4009BDisagreement({
        contract,
        hasEvidenceOrSecurityConflict: false,
        primary,
        verifier: observation('partial', 'mastered'),
      }),
    ).toBe('NON_MATERIAL_DISAGREEMENT');
    expect(
      classifyV4009BDisagreement({
        contract,
        hasEvidenceOrSecurityConflict: false,
        primary,
        verifier: observation('partial', 'partial'),
      }),
    ).toBe('MATERIAL_DISAGREEMENT');
    expect(
      classifyV4009BDisagreement({
        contract,
        hasEvidenceOrSecurityConflict: true,
        primary,
        verifier: observation('mastered', 'mastered'),
      }),
    ).toBe('MATERIAL_DISAGREEMENT');
  });

  it('creates a blind phase-one entry without identity, gold, category or cost', () => {
    const entry = createBlindReviewEntry('review-01', {
      candidateConsolidation: { state: 'COMPLETED' },
      contractKey: 'exercise-v1',
      contractVersion: '1.0.0',
      outputs: [{ feedback: 'Précis.' }, { feedback: 'Étayé.' }],
      rubric: { criteria: ['clarity'] },
      responseText: 'Réponse apprenant',
      taskContext: 'Contexte fiable',
      taskPrompt: 'Consigne',
    });
    const serialized = JSON.stringify(entry);
    for (const forbidden of [
      'modelId',
      'provider',
      'costUsd',
      'category',
      'gold',
      'role',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    const mapping = createBlindReviewMapping({
      entries: [{ caseId: 'case', repetition: 1, reviewId: entry.reviewId }],
      envelopeFingerprint: 'f'.repeat(64),
    });
    expect(mapping.mappingSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
