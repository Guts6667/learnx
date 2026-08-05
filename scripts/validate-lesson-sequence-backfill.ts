import 'dotenv/config';

import { createHash, randomUUID } from 'node:crypto';

import { prisma } from '../src/server/prisma.js';

type ExpectedItem = {
  destination: string;
  key: string;
  kind: string;
  targetId: string;
};

function lessonBaseHref(programSlug: string, lessonSlug: string): string {
  return `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lessonSlug)}`;
}

function destination(baseHref: string, kind: string, targetId: string): string {
  const activity = `${kind.toLowerCase()}:${targetId}`;
  if (kind === 'CONCEPT_ASSESSMENT') {
    return `${baseHref}/assessment?assessmentId=${encodeURIComponent(targetId)}&activity=${encodeURIComponent(activity)}`;
  }
  if (kind === 'EXERCISE') {
    return `${baseHref}/exercise/${encodeURIComponent(targetId)}?activity=${encodeURIComponent(activity)}`;
  }
  if (kind === 'QUIZ') {
    return `${baseHref}/quiz?quizId=${encodeURIComponent(targetId)}&activity=${encodeURIComponent(activity)}`;
  }
  return `${baseHref}?activity=${encodeURIComponent(activity)}#activity-${encodeURIComponent(activity)}`;
}

function targetId(item: {
  conceptAssessmentId: string | null;
  contentBlockId: string | null;
  exerciseId: string | null;
  quizId: string | null;
  resourceId: string | null;
  taskId: string | null;
}): string | null {
  return (
    item.contentBlockId ??
    item.resourceId ??
    item.taskId ??
    item.conceptAssessmentId ??
    item.exerciseId ??
    item.quizId
  );
}

function digest(items: ExpectedItem[]): string {
  const canonicalItems = items.map((item) => ({
    destination: item.destination,
    key: item.key,
    kind: item.kind,
    targetId: item.targetId,
  }));
  return createHash('sha256')
    .update(JSON.stringify(canonicalItems))
    .digest('hex');
}

async function expectDatabaseRejection(
  label: string,
  operation: () => Promise<unknown>,
  expectedMessage: string,
): Promise<string> {
  try {
    await operation();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(expectedMessage)) return label;
    throw new Error(`${label} failed for an unexpected reason: ${message}`, {
      cause: error,
    });
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

async function validateLiveConstraints(): Promise<string[]> {
  const sequenceItems = await prisma.lessonSequenceItem.findMany({
    orderBy: [{ lessonId: 'asc' }, { position: 'asc' }],
    select: {
      contentBlockId: true,
      id: true,
      key: true,
      lessonId: true,
      position: true,
    },
  });
  const contentItem = sequenceItems.find(
    (item) => item.contentBlockId !== null,
  );
  const foreignLesson = sequenceItems.find(
    (item) => item.lessonId !== contentItem?.lessonId,
  );
  const unsequencedResource = await prisma.resource.findFirst({
    where: { sequenceItem: null },
    select: { id: true, lessonId: true },
  });
  const resourceForeignLesson = sequenceItems.find(
    (item) => item.lessonId !== unsequencedResource?.lessonId,
  );
  const concept = await prisma.concept.findFirst({
    select: { id: true, lessonId: true },
  });
  const conceptForeignLesson = sequenceItems.find(
    (item) => item.lessonId !== concept?.lessonId,
  );
  if (
    !contentItem?.contentBlockId ||
    !foreignLesson ||
    !unsequencedResource ||
    !resourceForeignLesson ||
    !concept ||
    !conceptForeignLesson
  ) {
    throw new Error(
      'Constraint validation requires two lessons, one block and one unsequenced resource',
    );
  }
  const contentBlockId = contentItem.contentBlockId;

  return Promise.all([
    expectDatabaseRejection(
      'activity-key-immutable',
      () =>
        prisma.contentBlock.update({
          data: { key: `${contentItem.key}-${randomUUID()}` },
          where: { id: contentBlockId },
        }),
      'Lesson activity keys are immutable',
    ),
    expectDatabaseRejection(
      'sequence-identity-immutable',
      () =>
        prisma.lessonSequenceItem.update({
          data: { key: `${contentItem.key}-${randomUUID()}` },
          where: { id: contentItem.id },
        }),
      'Lesson sequence identities and targets are immutable',
    ),
    expectDatabaseRejection(
      'same-lesson-target-enforced',
      () =>
        prisma.lessonSequenceItem.create({
          data: {
            key: `constraint-probe-${randomUUID()}`,
            kind: 'RESOURCE',
            lessonId: resourceForeignLesson.lessonId,
            position: 1_000_000 + resourceForeignLesson.position,
            resourceId: unsequencedResource.id,
          },
        }),
      'lesson_sequence_items_resource_fkey',
    ),
    expectDatabaseRejection(
      'concept-assessment-same-lesson-enforced',
      () =>
        prisma.conceptAssessment.create({
          data: {
            assessmentType: 'QUIZ',
            conceptId: concept.id,
            key: `constraint-probe-${randomUUID()}`,
            lessonId: conceptForeignLesson.lessonId,
            position: 1_000_000,
          },
        }),
      'concept_assessments_lesson_id_concept_id_fkey',
    ),
  ]);
}

async function main(): Promise<void> {
  const lessons = await prisma.lesson.findMany({
    orderBy: { id: 'asc' },
    include: {
      contentBlocks: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      tasks: {
        where: { isCanonical: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      },
      concepts: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: {
          assessments: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
        },
      },
      exercises: {
        where: { isCanonical: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      },
      quizzes: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      module: { include: { stage: { include: { program: true } } } },
    },
  });
  const allSequenceItems = await prisma.lessonSequenceItem.findMany({
    orderBy: [{ lessonId: 'asc' }, { position: 'asc' }],
    select: {
      backfilledFromV2: true,
      conceptAssessmentId: true,
      contentBlockId: true,
      exerciseId: true,
      key: true,
      kind: true,
      lessonId: true,
      quizId: true,
      resourceId: true,
      taskId: true,
    },
  });
  const blockers: string[] = [];
  let expectedCount = 0;
  let quizCount = 0;
  let v2Lessons = 0;
  let authoredLessons = 0;
  const comparisons: Array<{
    expectedDigest: string;
    itemCount: number;
    lessonId: string;
    lessonSlug: string;
    migratedDigest: string;
  }> = [];

  for (const lesson of lessons) {
    for (const [label, items] of [
      ['content', lesson.contentBlocks],
      ['task', lesson.tasks],
      ['exercise', lesson.exercises],
      ['quiz', lesson.quizzes],
    ] as const) {
      const positions = new Set<number>();
      for (const item of items) {
        if (positions.has(item.position)) {
          blockers.push(
            `${lesson.slug}: duplicate ${label} position ${item.position}`,
          );
        }
        positions.add(item.position);
      }
    }
    const conceptPositions = new Set<number>();
    for (const concept of lesson.concepts) {
      if (conceptPositions.has(concept.position)) {
        blockers.push(
          `${lesson.slug}: duplicate concept position ${concept.position}`,
        );
      }
      conceptPositions.add(concept.position);
      const assessmentPositions = new Set<number>();
      for (const assessment of concept.assessments) {
        if (assessmentPositions.has(assessment.position)) {
          blockers.push(
            `${lesson.slug}/${concept.slug}: duplicate assessment position ${assessment.position}`,
          );
        }
        assessmentPositions.add(assessment.position);
      }
    }
    const baseHref = lessonBaseHref(
      lesson.module.stage.program.slug,
      lesson.slug,
    );
    const expected: ExpectedItem[] = [
      ...lesson.contentBlocks.map((item) => ({
        key: item.key,
        kind: 'CONTENT',
        targetId: item.id,
      })),
      ...lesson.tasks.map((item) => ({
        key: item.key,
        kind: 'TASK',
        targetId: item.id,
      })),
      ...lesson.concepts.flatMap((concept) =>
        concept.assessments.map((item) => ({
          key: item.key,
          kind: 'CONCEPT_ASSESSMENT',
          targetId: item.id,
        })),
      ),
      ...lesson.exercises.map((item) => ({
        key: item.key,
        kind: 'EXERCISE',
        targetId: item.id,
      })),
      ...lesson.quizzes.map((item) => ({
        key: item.key,
        kind: 'QUIZ',
        targetId: item.id,
      })),
    ].map((item) => ({
      ...item,
      destination: destination(baseHref, item.kind, item.targetId),
    }));
    const lessonSequence = allSequenceItems.filter(
      (item) => item.lessonId === lesson.id,
    );
    const actual = lessonSequence.map((item) => {
      const resolvedTargetId = targetId(item);
      return {
        destination: resolvedTargetId
          ? destination(baseHref, item.kind, resolvedTargetId)
          : '',
        key: item.key,
        kind: item.kind,
        targetId: resolvedTargetId ?? '',
      };
    });
    expectedCount += actual.length;
    quizCount += lesson.quizzes.length;
    if (!lessonSequence.some((item) => item.backfilledFromV2)) {
      authoredLessons += 1;
      continue;
    }
    v2Lessons += 1;
    comparisons.push({
      expectedDigest: digest(expected),
      itemCount: expected.length,
      lessonId: lesson.id,
      lessonSlug: lesson.slug,
      migratedDigest: digest(actual),
    });
    const mismatch = expected.findIndex((item, index) => {
      const candidate = actual[index];
      return (
        !candidate ||
        candidate.kind !== item.kind ||
        candidate.key !== item.key ||
        candidate.targetId !== item.targetId ||
        candidate.destination !== item.destination
      );
    });
    if (actual.length !== expected.length || mismatch >= 0) {
      const index =
        mismatch >= 0 ? mismatch : Math.min(actual.length, expected.length);
      blockers.push(
        `${lesson.slug}: mismatch at ${index + 1}; V2=${JSON.stringify(expected[index] ?? null)} migrated=${JSON.stringify(actual[index] ?? null)}`,
      );
    }
  }

  const inventory = {
    lessons: lessons.length,
    sequenceItems: expectedCount,
    quizzes: quizCount,
    v2BackfilledLessons: v2Lessons,
    authoredLessons,
    divergences: blockers.length,
    comparisons:
      process.env.VALIDATE_SEQUENCE_SUMMARY_ONLY === 'true'
        ? undefined
        : comparisons,
    constraintChecks:
      process.env.VALIDATE_SEQUENCE_CONSTRAINTS === 'true'
        ? await validateLiveConstraints()
        : [],
  };
  console.log(JSON.stringify(inventory, null, 2));
  if (blockers.length > 0) {
    throw new Error(`V3-017 migration blocked:\n${blockers.join('\n')}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
