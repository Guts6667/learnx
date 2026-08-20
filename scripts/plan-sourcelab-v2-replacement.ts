import 'dotenv/config';

import { parseArgs } from 'node:util';

import { ProgramEnrollmentStatus } from '../generated/prisma/client.js';
import {
  buildSourceLabReplacementPlan,
  SOURCELAB_REPLACEMENT_MODE,
  SOURCELAB_V1_IDENTITY,
  SOURCELAB_V2_IDENTITY,
  type SourceLabPreservationCounts,
  type SourceLabReplacementProgramState,
  type SourceLabV2PublicationState,
} from '../src/server/api/admin/sourcelab-program-replacement.js';
import { prisma } from '../src/server/prisma.js';

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    'dry-run': { type: 'boolean' },
    'owner-email': { type: 'string' },
  },
  strict: true,
});

function requireDryRun(): void {
  if (values['dry-run'] !== true) {
    throw new Error(
      `SourceLab replacement is ${SOURCELAB_REPLACEMENT_MODE}. Pass --dry-run; no apply mode exists.`,
    );
  }
}

function getOwnerEmail(): string {
  const email = values['owner-email']?.trim().toLowerCase();
  if (!email) throw new Error('--owner-email is required.');
  return email;
}

async function readPreservationCounts(
  programId: string,
): Promise<SourceLabPreservationCounts> {
  const [
    conceptAssessmentAttempts,
    conceptProgresses,
    exerciseSubmissions,
    lessonProgresses,
    moduleRuns,
    programProgresses,
    quizAttempts,
    stageAssessmentSubmissions,
    stageProgresses,
    taskCompletions,
  ] = await Promise.all([
    prisma.conceptAssessmentAttempt.count({
      where: {
        assessment: {
          lesson: { module: { stage: { programId } } },
        },
      },
    }),
    prisma.conceptProgress.count({
      where: { concept: { lesson: { module: { stage: { programId } } } } },
    }),
    prisma.exerciseSubmission.count({
      where: { exercise: { lesson: { module: { stage: { programId } } } } },
    }),
    prisma.lessonProgress.count({
      where: { lesson: { module: { stage: { programId } } } },
    }),
    prisma.moduleRun.count({
      where: { module: { stage: { programId } } },
    }),
    prisma.programProgress.count({ where: { programId } }),
    prisma.quizAttempt.count({
      where: { quiz: { lesson: { module: { stage: { programId } } } } },
    }),
    prisma.stageAssessmentSubmission.count({
      where: { stageAssessment: { stage: { programId } } },
    }),
    prisma.stageProgress.count({ where: { stage: { programId } } }),
    prisma.taskCompletion.count({
      where: { task: { lesson: { module: { stage: { programId } } } } },
    }),
  ]);

  return {
    conceptAssessmentAttempts,
    conceptProgresses,
    exerciseSubmissions,
    lessonProgresses,
    moduleRuns,
    programProgresses,
    quizAttempts,
    stageAssessmentSubmissions,
    stageProgresses,
    taskCompletions,
  };
}

function mapProgramState(program: {
  canonicalProgramKey: string;
  enrollments: Array<{ id: string }>;
  id: string;
  publishedVersionId: string | null;
  slug: string;
  status: SourceLabReplacementProgramState['status'];
  updatedAt: Date;
  visibility: SourceLabReplacementProgramState['visibility'];
}): SourceLabReplacementProgramState {
  return {
    activeEnrollmentIds: program.enrollments.map(({ id }) => id).sort(),
    canonicalProgramKey: program.canonicalProgramKey,
    id: program.id,
    publishedVersionId: program.publishedVersionId,
    slug: program.slug,
    status: program.status,
    updatedAt: program.updatedAt.toISOString(),
    visibility: program.visibility,
  };
}

function getV2PublicationState(program: {
  stages: Array<{
    assessments: Array<{ id: string }>;
    isPublished: boolean;
    modules: Array<{
      isPublished: boolean;
      lessons: Array<{
        concepts: Array<{ assessments: Array<{ id: string }> }>;
        isPublished: boolean;
      }>;
    }>;
  }>;
}): SourceLabV2PublicationState {
  const modules = program.stages.flatMap((stage) => stage.modules);
  const lessons = modules.flatMap((module) => module.lessons);
  const concepts = lessons.flatMap((lesson) => lesson.concepts);

  return {
    allLessonsPublished: lessons.every(({ isPublished }) => isPublished),
    allModulesPublished: modules.every(({ isPublished }) => isPublished),
    allRequiredConceptsAssessed: concepts.every(
      ({ assessments }) => assessments.length > 0,
    ),
    allStagesHaveFinalAssessment: program.stages.every(
      ({ assessments }) => assessments.length > 0,
    ),
    allStagesPublished: program.stages.every(({ isPublished }) => isPublished),
    lessonCount: lessons.length,
    moduleCount: modules.length,
    requiredConceptCount: concepts.length,
    stageCount: program.stages.length,
  };
}

async function main(): Promise<void> {
  requireDryRun();
  const owner = await prisma.user.findUnique({
    where: { email: getOwnerEmail() },
    select: { id: true },
  });
  if (!owner) throw new Error('The replacement owner does not exist.');

  const programs = await prisma.program.findMany({
    where: {
      ownerId: owner.id,
      slug: { in: [SOURCELAB_V1_IDENTITY.slug, SOURCELAB_V2_IDENTITY.slug] },
    },
    select: {
      canonicalProgramKey: true,
      enrollments: {
        where: { status: ProgramEnrollmentStatus.ACTIVE },
        select: { id: true },
      },
      id: true,
      publishedVersionId: true,
      slug: true,
      stages: {
        orderBy: { position: 'asc' },
        select: {
          assessments: {
            where: { isRequired: true },
            select: { id: true },
          },
          isPublished: true,
          modules: {
            orderBy: { position: 'asc' },
            select: {
              isPublished: true,
              lessons: {
                orderBy: { position: 'asc' },
                select: {
                  concepts: {
                    where: { isRequired: true },
                    select: {
                      assessments: {
                        where: { isRequired: true },
                        select: { id: true },
                      },
                    },
                  },
                  isPublished: true,
                },
              },
            },
          },
        },
      },
      status: true,
      updatedAt: true,
      visibility: true,
    },
  });
  const v1Record = programs.find(
    ({ slug }) => slug === SOURCELAB_V1_IDENTITY.slug,
  );
  const v2Record = programs.find(
    ({ slug }) => slug === SOURCELAB_V2_IDENTITY.slug,
  );
  const preservation = v1Record
    ? await readPreservationCounts(v1Record.id)
    : {
        conceptAssessmentAttempts: 0,
        conceptProgresses: 0,
        exerciseSubmissions: 0,
        lessonProgresses: 0,
        moduleRuns: 0,
        programProgresses: 0,
        quizAttempts: 0,
        stageAssessmentSubmissions: 0,
        stageProgresses: 0,
        taskCompletions: 0,
      };
  const plan = buildSourceLabReplacementPlan({
    preservation,
    v1: v1Record ? mapProgramState(v1Record) : null,
    v2: v2Record
      ? {
          ...mapProgramState(v2Record),
          publication: getV2PublicationState(v2Record),
        }
      : null,
  });

  console.info(JSON.stringify(plan, null, 2));
  if (plan.blockers.length > 0) process.exitCode = 2;
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
