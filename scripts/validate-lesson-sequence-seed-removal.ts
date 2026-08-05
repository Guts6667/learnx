import 'dotenv/config';

import { LessonProgressStatus } from '../generated/prisma/client.js';
import {
  createSeedProgramRepository,
  readSampleSeed,
  seedSampleProgram,
} from '../prisma/seed.js';
import { prisma } from '../src/server/prisma.js';

const probeProgramSlug = 'v3-017-seed-removal-probe';

async function main(): Promise<void> {
  if (process.env.LEARNX_INTEGRATION_DATABASE !== 'ephemeral') {
    throw new Error('This validation is restricted to an ephemeral database.');
  }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new Error('ADMIN_EMAIL is required.');
  const owner = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (!owner) throw new Error('The validation owner does not exist.');

  const source = await readSampleSeed();
  const sourceStage = source.program.stages[0];
  const sourceModule = sourceStage.modules[0];
  const sourceLesson = sourceModule.lessons[0];
  const contentBlocks = sourceLesson.contentBlocks.slice(0, 2).map((block) => ({
    ...block,
    content: { ...block.content, sourceKeys: [] },
  }));
  const lesson = {
    ...sourceLesson,
    concepts: [],
    contentBlocks,
    quizzes: [],
    resources: [],
    sequence: contentBlocks.map((block) => ({
      key: block.key,
      kind: 'CONTENT' as const,
    })),
    slug: 'pointeur-sequence',
    tasks: [],
    title: 'Validation du retrait de séquence',
  };
  const program = {
    ...source.program,
    slug: probeProgramSlug,
    stages: [
      {
        ...sourceStage,
        modules: [
          {
            ...sourceModule,
            lessons: [lesson],
            slug: 'module-sequence',
          },
        ],
        slug: 'etape-sequence',
      },
    ],
    title: 'V3-017 seed removal probe',
  };

  await prisma.$transaction(async (transaction) => {
    await seedSampleProgram(
      createSeedProgramRepository(transaction),
      owner.id,
      program,
      [],
    );
  });

  const storedLesson = await prisma.lesson.findFirstOrThrow({
    where: {
      slug: lesson.slug,
      module: { stage: { program: { ownerId: owner.id, slug: program.slug } } },
    },
    select: {
      id: true,
      lessonSequenceItems: {
        where: { key: contentBlocks[1].key, kind: 'CONTENT' },
        select: { id: true },
      },
    },
  });
  const removedItem = storedLesson.lessonSequenceItems[0];
  if (!removedItem) throw new Error('The removable sequence item is missing.');
  const startedAt = new Date('2026-08-06T08:00:00.000Z');
  const lastViewedAt = new Date('2026-08-06T08:30:00.000Z');
  await prisma.lessonProgress.upsert({
    where: {
      userId_lessonId: { lessonId: storedLesson.id, userId: owner.id },
    },
    create: {
      currentSequenceItemId: removedItem.id,
      lastViewedAt,
      lessonId: storedLesson.id,
      percent: 37,
      startedAt,
      status: LessonProgressStatus.IN_PROGRESS,
      userId: owner.id,
    },
    update: {
      currentSequenceItemId: removedItem.id,
      lastViewedAt,
      percent: 37,
      startedAt,
      status: LessonProgressStatus.IN_PROGRESS,
    },
  });
  await prisma.note.create({
    data: {
      lessonId: storedLesson.id,
      markdown: 'Note conservée pendant le retrait de l’activité.',
      title: 'Preuve V3-017',
      userId: owner.id,
    },
  });
  const before = {
    conceptAttempts: await prisma.conceptAssessmentAttempt.count(),
    exerciseSubmissions: await prisma.exerciseSubmission.count(),
    notes: await prisma.note.count(),
    quizAttempts: await prisma.quizAttempt.count(),
  };

  const reducedLesson = {
    ...lesson,
    contentBlocks: contentBlocks.slice(0, 1),
    sequence: lesson.sequence.slice(0, 1),
  };
  await prisma.$transaction(async (transaction) => {
    await seedSampleProgram(
      createSeedProgramRepository(transaction),
      owner.id,
      {
        ...program,
        stages: program.stages.map((stage) => ({
          ...stage,
          modules: stage.modules.map((module) => ({
            ...module,
            lessons: [reducedLesson],
          })),
        })),
      },
      [],
    );
  });

  const [progress, removedSequenceItem, after] = await Promise.all([
    prisma.lessonProgress.findUniqueOrThrow({
      where: {
        userId_lessonId: { lessonId: storedLesson.id, userId: owner.id },
      },
      select: {
        currentSequenceItemId: true,
        lastViewedAt: true,
        percent: true,
        startedAt: true,
        status: true,
      },
    }),
    prisma.lessonSequenceItem.findUnique({ where: { id: removedItem.id } }),
    Promise.all([
      prisma.conceptAssessmentAttempt.count(),
      prisma.exerciseSubmission.count(),
      prisma.note.count(),
      prisma.quizAttempt.count(),
    ]),
  ]);
  const afterCounts = {
    conceptAttempts: after[0],
    exerciseSubmissions: after[1],
    notes: after[2],
    quizAttempts: after[3],
  };
  if (
    progress.currentSequenceItemId !== null ||
    progress.percent !== 37 ||
    progress.status !== LessonProgressStatus.IN_PROGRESS ||
    progress.startedAt?.getTime() !== startedAt.getTime() ||
    progress.lastViewedAt?.getTime() !== lastViewedAt.getTime() ||
    removedSequenceItem !== null ||
    JSON.stringify(before) !== JSON.stringify(afterCounts)
  ) {
    throw new Error('Seed removal validation failed.');
  }

  console.log(
    JSON.stringify(
      {
        attemptsAndNotes: afterCounts,
        pointerNeutralized: true,
        progressPreserved: true,
        removedSequenceItem: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
