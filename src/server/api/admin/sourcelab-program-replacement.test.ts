import { describe, expect, it } from 'vitest';

import {
  buildSourceLabReplacementPlan,
  SOURCELAB_REPLACEMENT_MODE,
  type SourceLabPreservationCounts,
  type SourceLabReplacementSnapshot,
} from './sourcelab-program-replacement';

const preservation: SourceLabPreservationCounts = {
  conceptAssessmentAttempts: 11,
  conceptProgresses: 12,
  exerciseSubmissions: 13,
  lessonProgresses: 14,
  moduleRuns: 15,
  programProgresses: 2,
  quizAttempts: 16,
  stageAssessmentSubmissions: 3,
  stageProgresses: 6,
  taskCompletions: 17,
};

function createReadySnapshot(): SourceLabReplacementSnapshot {
  return {
    preservation,
    v1: {
      activeEnrollmentIds: ['enrollment-1', 'enrollment-2'],
      canonicalProgramKey: 'ingenieur-logiciel-production-sourcelab',
      id: 'program-v1',
      publishedVersionId: 'version-v1',
      slug: 'ingenieur-logiciel-production-sourcelab',
      status: 'ACTIVE',
      updatedAt: '2026-08-21T08:00:00.000Z',
      visibility: 'PUBLIC',
    },
    v2: {
      activeEnrollmentIds: [],
      canonicalProgramKey: 'sourcelab-docker-api-socle-ingestion',
      id: 'program-v2',
      publication: {
        allLessonsPublished: true,
        allModulesPublished: true,
        allRequiredConceptsAssessed: true,
        allStagesHaveFinalAssessment: true,
        allStagesPublished: true,
        lessonCount: 7,
        moduleCount: 3,
        requiredConceptCount: 7,
        stageCount: 3,
      },
      publishedVersionId: 'version-v2',
      slug: 'sourcelab-docker-api-socle-ingestion',
      status: 'ACTIVE',
      updatedAt: '2026-08-21T09:00:00.000Z',
      visibility: 'PRIVATE',
    },
  };
}

describe('SourceLab V2 replacement plan', () => {
  it('plans coexistence without any deletion or silent progress transfer', () => {
    const plan = buildSourceLabReplacementPlan(createReadySnapshot());

    expect(plan).toMatchObject({
      alreadyApplied: false,
      blockers: [],
      executionEnabled: false,
      mode: SOURCELAB_REPLACEMENT_MODE,
      preservation,
    });
    expect(plan.actions).toHaveLength(3);
    expect(plan.actions.every(({ operation }) => operation === 'UPDATE')).toBe(
      true,
    );
    expect(plan.actions.map(({ target }) => target)).toEqual([
      'V1_PROGRAM',
      'V1_ACTIVE_ENROLLMENTS',
      'V2_PROGRAM',
    ]);
  });

  it('is deterministic and therefore safe to compare after a mandatory dry-run', () => {
    const snapshot = createReadySnapshot();

    expect(buildSourceLabReplacementPlan(snapshot).planId).toBe(
      buildSourceLabReplacementPlan(structuredClone(snapshot)).planId,
    );
  });

  it('treats the final state as already applied without proposing mutations', () => {
    const snapshot = createReadySnapshot();
    if (!snapshot.v1 || !snapshot.v2) throw new Error('Fixture incomplete.');
    snapshot.v1.status = 'ARCHIVED';
    snapshot.v1.visibility = 'PRIVATE';
    snapshot.v1.activeEnrollmentIds = [];
    snapshot.v2.visibility = 'PUBLIC';

    const plan = buildSourceLabReplacementPlan(snapshot);

    expect(plan.alreadyApplied).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.actions).toEqual([]);
    expect(plan.preservation).toEqual(preservation);
  });

  it('blocks a draft V2 before any cutover can be considered', () => {
    const snapshot = createReadySnapshot();
    if (!snapshot.v2) throw new Error('Fixture incomplete.');
    snapshot.v2.status = 'DRAFT';
    snapshot.v2.publishedVersionId = null;
    snapshot.v2.publication.allLessonsPublished = false;

    const plan = buildSourceLabReplacementPlan(snapshot);

    expect(plan.actions).toEqual([]);
    expect(plan.blockers.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'V2_NOT_OFFICIALLY_PUBLISHED',
        'V2_DESCENDANTS_NOT_PUBLISHED',
      ]),
    );
  });

  it('blocks any collision between V1 and V2 identities', () => {
    const snapshot = createReadySnapshot();
    if (!snapshot.v1 || !snapshot.v2) throw new Error('Fixture incomplete.');
    snapshot.v2.id = snapshot.v1.id;

    expect(
      buildSourceLabReplacementPlan(snapshot).blockers.map(({ code }) => code),
    ).toContain('PROGRAM_IDENTITIES_COLLIDE');
  });

  it('blocks an unexpected historical identity', () => {
    const snapshot = createReadySnapshot();
    if (!snapshot.v1) throw new Error('Fixture incomplete.');
    snapshot.v1.canonicalProgramKey = 'unrelated-program';

    expect(
      buildSourceLabReplacementPlan(snapshot).blockers.map(({ code }) => code),
    ).toContain('V1_IDENTITY_MISMATCH');
  });

  it('does not accept a corrupted post-cutover structure as already applied', () => {
    const snapshot = createReadySnapshot();
    if (!snapshot.v1 || !snapshot.v2) throw new Error('Fixture incomplete.');
    snapshot.v1.status = 'ARCHIVED';
    snapshot.v1.visibility = 'PRIVATE';
    snapshot.v1.activeEnrollmentIds = [];
    snapshot.v2.visibility = 'PUBLIC';
    snapshot.v2.publication.lessonCount = 6;

    const plan = buildSourceLabReplacementPlan(snapshot);

    expect(plan.alreadyApplied).toBe(false);
    expect(plan.blockers.map(({ code }) => code)).toContain(
      'V2_STRUCTURE_INCOMPLETE',
    );
  });

  it('documents a bounded rollback that cannot merge V1 and V2 progress', () => {
    const plan = buildSourceLabReplacementPlan(createReadySnapshot());

    expect(plan.rollback.conditions).toHaveLength(3);
    expect(
      plan.rollback.intendedActions.every(
        ({ operation }) => operation === 'UPDATE',
      ),
    ).toBe(true);
    expect(plan.rollback.intendedActions.map(({ target }) => target)).toEqual([
      'V2_PROGRAM',
      'V1_PROGRAM',
      'V1_ACTIVE_ENROLLMENTS',
    ]);
  });
});
