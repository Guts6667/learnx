import {
  buildExerciseCorrectionArchetype,
  PRODUCTIVE_EXERCISE_ACTIVITY_TYPES,
  resolveExerciseCorrectionContract,
} from '@/lib/exercise-correction-contracts';

const context = {
  activityKey: 'activity-1',
  activityType: 'writing',
  explicitContract: null,
  instructions:
    'Formuler une recommandation, citer deux éléments du dossier et justifier le lien.',
  language: 'fr-FR',
  lessonObjectives: ['Distinguer observation et interprétation.'],
  lessonSlug: 'observer-sans-inventer',
  lessonSummary: 'La leçon sépare les faits, les inférences et les limites.',
  programSlug: 'programme-pilote',
  title: 'Justifier une recommandation',
} as const;

describe('exercise correction contract archetypes', () => {
  it.each(PRODUCTIVE_EXERCISE_ACTIVITY_TYPES)(
    'builds a published, three-criterion %s contract bound to the exercise',
    (activityType) => {
      const contract = buildExerciseCorrectionArchetype({
        ...context,
        activityType,
      });

      expect(contract.lifecycle.status).toBe('PUBLISHED');
      expect(contract.target).toEqual({
        activityKey: context.activityKey,
        activityType,
        kind: 'EXERCISE',
      });
      expect(contract.criteria).toHaveLength(3);
      expect(
        contract.criteria.reduce(
          (total, criterion) => total + criterion.weight,
          0,
        ),
      ).toBe(100);
      expect(contract.objectives.join(' ')).toContain(context.title);
      expect(contract.criteria[0]?.expectedElements.join(' ')).toContain(
        context.instructions,
      );
    },
  );

  it('uses the published specialized contract before an archetype', () => {
    const specialized = buildExerciseCorrectionArchetype({
      ...context,
      activityType: 'writing',
    });
    const result = resolveExerciseCorrectionContract({
      ...context,
      explicitContract: specialized,
    });

    expect(result).toMatchObject({
      eligible: true,
      source: 'SPECIALIZED',
    });
  });

  it('changes the contract identity when an authoring input changes', () => {
    const original = buildExerciseCorrectionArchetype({
      ...context,
      activityType: 'writing',
    });
    const changed = buildExerciseCorrectionArchetype({
      ...context,
      activityType: 'writing',
      instructions: `${context.instructions} Signaler aussi une limite.`,
    });

    expect(changed.contractKey).not.toBe(original.contractKey);
    expect(
      buildExerciseCorrectionArchetype({
        ...context,
        activityType: 'writing',
      }).contractKey,
    ).toBe(original.contractKey);
  });

  it('never hides an invalid explicit contract behind an archetype', () => {
    expect(
      resolveExerciseCorrectionContract({
        ...context,
        explicitContract: { lifecycle: { status: 'DRAFT' } },
      }),
    ).toEqual({
      eligible: false,
      reasons: ['INVALID_CONTRACT'],
      source: 'EXPLICIT_BLOCKED',
    });
  });

  it('rejects a specialized contract bound to another exercise', () => {
    const specialized = buildExerciseCorrectionArchetype({
      ...context,
      activityKey: 'another-activity',
      activityType: 'writing',
    });

    expect(
      resolveExerciseCorrectionContract({
        ...context,
        explicitContract: specialized,
      }),
    ).toEqual({
      eligible: false,
      reasons: ['CONTRACT_TARGET_MISMATCH'],
      source: 'EXPLICIT_BLOCKED',
    });
  });

  it('keeps unsupported languages fail-closed', () => {
    expect(
      resolveExerciseCorrectionContract({
        ...context,
        explicitContract: null,
        language: 'en-US',
      }),
    ).toEqual({
      eligible: false,
      reasons: ['LANGUAGE_NOT_SUPPORTED'],
      source: 'UNSUPPORTED',
    });
  });
});
