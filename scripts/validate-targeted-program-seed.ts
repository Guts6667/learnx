import { Role } from '../generated/prisma/client.js';
import { prisma } from '../src/server/prisma.js';

const SEED_OWNER_EMAIL = 'platform-seed-ci@example.invalid';
const TARGET_PROGRAM_SLUG = 'platform-apm-entretien-tryhackme';

async function prepareOwner() {
  await prisma.user.upsert({
    where: { email: SEED_OWNER_EMAIL },
    create: {
      email: SEED_OWNER_EMAIL,
      passwordHash: 'ci-account-cannot-authenticate',
      displayName: 'Platform seed CI',
      role: Role.ADMIN,
    },
    update: {},
  });
}

async function getSignature() {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: SEED_OWNER_EMAIL },
    select: { id: true },
  });
  const program = await prisma.program.findUnique({
    where: {
      ownerId_slug: {
        ownerId: owner.id,
        slug: TARGET_PROGRAM_SLUG,
      },
    },
    select: { id: true },
  });

  if (!program) {
    return '0|0|0|0|0|0|0|0|0|0|0|0|0';
  }

  const stages = await prisma.stage.findMany({
    where: { programId: program.id },
    select: { id: true, isPublished: true },
  });
  const stageIds = stages.map(({ id }) => id);
  const modules = await prisma.module.findMany({
    where: { stageId: { in: stageIds } },
    select: { id: true, isPublished: true },
  });
  const moduleIds = modules.map(({ id }) => id);
  const lessons = await prisma.lesson.findMany({
    where: { moduleId: { in: moduleIds } },
    select: { id: true, isPublished: true },
  });
  const lessonIds = lessons.map(({ id }) => id);
  const assessments = await prisma.conceptAssessment.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true },
  });
  const assessmentIds = assessments.map(({ id }) => id);

  const [contentBlocks, resources, exercises, questions, stageAssessments] =
    await Promise.all([
      prisma.contentBlock.count({ where: { lessonId: { in: lessonIds } } }),
      prisma.resource.count({ where: { lessonId: { in: lessonIds } } }),
      prisma.exercise.count({
        where: { lessonId: { in: lessonIds }, isCanonical: true },
      }),
      prisma.conceptAssessmentQuestion.count({
        where: { assessmentId: { in: assessmentIds } },
      }),
      prisma.stageAssessment.count({ where: { stageId: { in: stageIds } } }),
    ]);

  return [
    1,
    stages.length,
    modules.length,
    lessons.length,
    contentBlocks,
    resources,
    exercises,
    assessments.length,
    questions,
    stageAssessments,
    stages.filter(({ isPublished }) => isPublished).length,
    modules.filter(({ isPublished }) => isPublished).length,
    lessons.filter(({ isPublished }) => isPublished).length,
  ].join('|');
}

async function main() {
  const command = process.argv[2];

  if (command === 'prepare-owner') {
    await prepareOwner();
    return;
  }

  if (command === 'signature') {
    console.log(await getSignature());
    return;
  }

  throw new Error('Expected prepare-owner or signature.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
