import {
  buildPublicationPlan,
  type PublicationModule,
  type PublicationProgram,
  type PublicationStage,
} from '../../src/server/api/admin/publication-plan';

const timestamp = '2026-08-03T12:00:00.000Z';

function createModule(
  overrides: Partial<PublicationModule> = {},
): PublicationModule {
  return {
    id: 'module-1',
    isPublished: false,
    lessons: [
      {
        id: 'lesson-1',
        isPublished: false,
        requiredConcepts: [
          {
            assessmentIds: ['assessment-1'],
            id: 'concept-1',
            title: 'Notion requise',
          },
        ],
        title: 'Leçon complète',
        updatedAt: timestamp,
      },
    ],
    title: 'Module complet',
    updatedAt: timestamp,
    ...overrides,
  };
}

function createStage(
  overrides: Partial<PublicationStage> = {},
): PublicationStage {
  return {
    finalAssessmentIds: ['final-1'],
    id: 'stage-1',
    isPublished: false,
    modules: [createModule()],
    title: 'Étape complète',
    updatedAt: timestamp,
    ...overrides,
  };
}

function createProgram(
  overrides: Partial<PublicationProgram> = {},
): PublicationProgram {
  return {
    id: 'program-1',
    stages: [createStage()],
    status: 'DRAFT',
    title: 'Programme complet',
    updatedAt: timestamp,
    ...overrides,
  };
}

describe('publication plan', () => {
  it('prévoit une publication complète et déterministe du programme', () => {
    const target = { entity: createProgram(), type: 'PROGRAM' as const };
    const first = buildPublicationPlan(target, 'PUBLISH', 'PARENT_ONLY');
    const second = buildPublicationPlan(target, 'PUBLISH', 'FULL');

    expect(first.mode).toBe('FULL');
    expect(first.planId).toBe(second.planId);
    expect(first.blockers).toEqual([]);
    expect(first.changes.map(({ type }) => type)).toEqual([
      'PROGRAM',
      'STAGE',
      'MODULE',
      'LESSON',
    ]);
  });

  it('décrit toutes les préconditions pédagogiques manquantes', () => {
    const incompleteLesson = {
      ...createModule().lessons[0],
      requiredConcepts: [
        {
          assessmentIds: [],
          id: 'concept-1',
          title: 'Notion non évaluée',
        },
      ],
    };
    const program = createProgram({
      stages: [
        createStage({
          finalAssessmentIds: [],
          modules: [createModule({ lessons: [incompleteLesson] })],
        }),
      ],
    });
    const plan = buildPublicationPlan(
      { entity: program, type: 'PROGRAM' },
      'PUBLISH',
      'FULL',
    );

    expect(plan.blockers.map(({ code }) => code)).toEqual([
      'FINAL_ASSESSMENT_MISSING',
      'LESSON_ASSESSMENT_MISSING',
    ]);
  });

  it('conserve les descendants en dépublication parent seul', () => {
    const stage = createStage({
      isPublished: true,
      modules: [
        createModule({
          isPublished: true,
          lessons: [{ ...createModule().lessons[0], isPublished: true }],
        }),
      ],
    });
    const plan = buildPublicationPlan(
      { entity: stage, type: 'STAGE' },
      'UNPUBLISH',
      'PARENT_ONLY',
    );

    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({ id: 'stage-1', to: false });
    expect(plan.warnings[0]).toContain('états des descendants');
  });

  it('dépublie chaque descendant en cascade totale sans donnée de progression', () => {
    const module = createModule({
      isPublished: true,
      lessons: [{ ...createModule().lessons[0], isPublished: true }],
    });
    const plan = buildPublicationPlan(
      { entity: module, type: 'MODULE' },
      'UNPUBLISH',
      'FULL',
    );

    expect(plan.changes).toEqual([
      expect.objectContaining({ id: 'module-1', to: false }),
      expect.objectContaining({ id: 'lesson-1', to: false }),
    ]);
    expect(plan.warnings[0]).toContain(
      'progressions et soumissions seront conservées',
    );
  });

  it('rend une répétition sans effet lorsque l’état cible est déjà atteint', () => {
    const module = createModule({
      isPublished: true,
      lessons: [{ ...createModule().lessons[0], isPublished: true }],
    });
    const plan = buildPublicationPlan(
      { entity: module, type: 'MODULE' },
      'PUBLISH',
      'FULL',
    );

    expect(plan.blockers).toEqual([]);
    expect(plan.changes).toEqual([]);
  });

  it('bloque une hiérarchie trop grande plutôt que de perdre l’atomicité', () => {
    const baseLesson = createModule().lessons[0];
    const module = createModule({
      lessons: Array.from({ length: 1_000 }, (_, index) => ({
        ...baseLesson,
        id: `lesson-${index}`,
      })),
    });
    const plan = buildPublicationPlan(
      { entity: module, type: 'MODULE' },
      'PUBLISH',
      'FULL',
    );

    expect(plan.blockers).toContainEqual(
      expect.objectContaining({ code: 'SCOPE_TOO_LARGE' }),
    );
  });
});
