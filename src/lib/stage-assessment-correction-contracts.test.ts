import { contractRaw } from '@/server/corrections/correction-orchestration.test-support';

import { resolveStageAssessmentCorrectionContract } from './stage-assessment-correction-contracts';

const ACTIVITY_KEY = 'psychologie-palier-1-evaluation-1';

/** The promoted exercise contract, re-targeted at a stage assessment. */
const publishedContract = {
  ...contractRaw,
  target: {
    activityKey: ACTIVITY_KEY,
    activityType: 'written_assignment',
    kind: 'STAGE_ASSESSMENT',
  },
};

function resolve(overrides: Record<string, unknown> = {}) {
  return resolveStageAssessmentCorrectionContract({
    activityKey: ACTIVITY_KEY,
    explicitContract: publishedContract,
    language: 'fr-FR',
    ...overrides,
  });
}

describe('resolveStageAssessmentCorrectionContract', () => {
  it('accepte un contrat explicite publié et rattaché', () => {
    const resolution = resolve();
    expect(resolution.eligible).toBe(true);
  });

  it('refuse une rubrique héritée plutôt que d’en synthétiser un contrat', () => {
    // This is the shape every seeded stage assessment carries today. The
    // exercise resolver would build an archetype from it; a surface that gates
    // progression does not get one.
    const resolution = resolve({
      explicitContract: [
        {
          criterion: 'Cadrage scientifique',
          requirements: ['Les faits et interprétations sont distingués.'],
          weight: 25,
        },
      ],
    });
    expect(resolution).toEqual({
      eligible: false,
      reasons: ['CONTRACT_NOT_RUNNABLE'],
    });
  });

  it('refuse une évaluation sans rubrique', () => {
    expect(resolve({ explicitContract: null })).toEqual({
      eligible: false,
      reasons: ['NO_EXPLICIT_CONTRACT'],
    });
  });

  it('refuse un contrat d’exercice appliqué à une évaluation', () => {
    expect(
      resolve({
        explicitContract: {
          ...publishedContract,
          target: {
            activityKey: ACTIVITY_KEY,
            activityType: 'writing',
            kind: 'EXERCISE',
          },
        },
      }),
    ).toEqual({ eligible: false, reasons: ['CONTRACT_TARGET_MISMATCH'] });
  });

  it('refuse quand aucune clé stable ne permet le rattachement', () => {
    // The state of the world today: stage assessments have no key column, so
    // belonging cannot be checked. Refusing is the only honest answer — a valid
    // contract could otherwise be attached to the wrong assessment.
    expect(resolve({ activityKey: null })).toEqual({
      eligible: false,
      reasons: ['CONTRACT_BINDING_UNAVAILABLE'],
    });
  });

  it('refuse un contrat rattaché à une autre évaluation', () => {
    expect(
      resolve({ activityKey: 'psychologie-palier-2-evaluation-1' }),
    ).toEqual({ eligible: false, reasons: ['CONTRACT_TARGET_MISMATCH'] });
  });

  it('refuse une langue hors périmètre', () => {
    expect(resolve({ language: 'en-GB' })).toEqual({
      eligible: false,
      reasons: ['LANGUAGE_NOT_SUPPORTED'],
    });
  });
});
