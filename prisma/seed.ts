import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { assertRequiredConceptHasValidationActivity } from '../src/lib/concepts';

import {
  ConceptAssessmentType,
  ProgramStatus,
  type Prisma,
  type PrismaClient,
} from '../generated/prisma/client';

const programStatusSchema = z.enum(['draft', 'active', 'archived']);
const conceptAssessmentTypeSchema = z.enum([
  'quiz',
  'short_answer',
  'practice',
  'flashcard',
  'case_question',
]);
const conceptAssessmentSchema = z
  .object({ type: conceptAssessmentTypeSchema })
  .passthrough();
const conceptSchema = z
  .object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    position: z.number().int().nonnegative(),
    isRequired: z.boolean().default(true),
    masteryThreshold: z.number().min(0).max(100).default(70),
    assessment: conceptAssessmentSchema.optional(),
  })
  .refine((concept) => !concept.isRequired || concept.assessment, {
    message: 'A required concept must define a validation activity.',
    path: ['assessment'],
  });

const lessonSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  position: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive().optional(),
  concepts: z.array(conceptSchema).default([]),
});

const moduleSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  position: z.number().int().nonnegative(),
  lessons: z.array(lessonSchema),
});

const stageSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  position: z.number().int().nonnegative(),
  estimatedDurationDays: z.number().int().positive().optional(),
  modules: z.array(moduleSchema),
});

const sampleProgramSchema = z.object({
  program: z.object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    description: z.string().trim().min(1),
    status: programStatusSchema,
    position: z.number().int().nonnegative(),
    estimatedDurationDays: z.number().int().positive().optional(),
    stages: z.array(stageSchema),
  }),
});

export type SampleProgram = z.infer<typeof sampleProgramSchema>['program'];

export interface SeedProgramRepository {
  replaceConceptAssessments(
    conceptId: string,
    assessments: Array<{
      assessmentType: ConceptAssessmentType;
      isRequired: boolean;
      position: number;
    }>,
  ): Promise<void>;
  upsertConcept(input: {
    lessonId: string;
    title: string;
    slug: string;
    description?: string;
    position: number;
    isRequired: boolean;
    masteryThreshold: number;
  }): Promise<{ id: string }>;
  upsertLesson(input: {
    moduleId: string;
    title: string;
    slug: string;
    summary: string;
    objectives: Prisma.InputJsonValue;
    prerequisites: Prisma.InputJsonValue;
    estimatedMinutes?: number;
    position: number;
  }): Promise<{ id: string }>;
  upsertModule(input: {
    stageId: string;
    title: string;
    slug: string;
    description: string;
    position: number;
  }): Promise<{ id: string }>;
  upsertProgram(input: {
    ownerId: string;
    title: string;
    slug: string;
    description: string;
    status: ProgramStatus;
    position: number;
    estimatedDurationDays?: number;
  }): Promise<{ id: string }>;
  upsertStage(input: {
    programId: string;
    title: string;
    slug: string;
    description: string;
    position: number;
    estimatedDurationDays?: number;
  }): Promise<{ id: string }>;
}

function toConceptAssessmentType(
  type: z.infer<typeof conceptAssessmentTypeSchema>,
): ConceptAssessmentType {
  return {
    case_question: ConceptAssessmentType.CASE_QUESTION,
    flashcard: ConceptAssessmentType.FLASHCARD,
    practice: ConceptAssessmentType.PRACTICE,
    quiz: ConceptAssessmentType.QUIZ,
    short_answer: ConceptAssessmentType.SHORT_ANSWER,
  }[type];
}

function toProgramStatus(
  status: z.infer<typeof programStatusSchema>,
): ProgramStatus {
  return {
    draft: ProgramStatus.DRAFT,
    active: ProgramStatus.ACTIVE,
    archived: ProgramStatus.ARCHIVED,
  }[status];
}

function getLessonObjectives(
  lesson: z.infer<typeof lessonSchema>,
): Prisma.InputJsonValue {
  return lesson.concepts.map((concept) => concept.title);
}

function getLessonSummary(lesson: z.infer<typeof lessonSchema>): string {
  const objectives = getLessonObjectives(lesson);

  return Array.isArray(objectives) && objectives.length > 0
    ? `Objectifs : ${objectives.join(', ')}.`
    : `Introduction à ${lesson.title}.`;
}

function getStageDescription(stage: z.infer<typeof stageSchema>): string {
  return `Étape du programme consacrée à ${stage.title}.`;
}

function getModuleDescription(module: z.infer<typeof moduleSchema>): string {
  return `Module consacré à ${module.title}.`;
}

export async function readSampleProgram(): Promise<SampleProgram> {
  const sourcePath = resolve(process.cwd(), 'seed/sample-program.json');
  const source = await readFile(sourcePath, 'utf8');

  return sampleProgramSchema.parse(JSON.parse(source) as unknown).program;
}

export async function seedSampleProgram(
  repository: SeedProgramRepository,
  ownerId: string,
  sampleProgram: SampleProgram,
): Promise<void> {
  const program = await repository.upsertProgram({
    ownerId,
    title: sampleProgram.title,
    slug: sampleProgram.slug,
    description: sampleProgram.description,
    status: toProgramStatus(sampleProgram.status),
    position: sampleProgram.position,
    estimatedDurationDays: sampleProgram.estimatedDurationDays,
  });

  for (const stageData of sampleProgram.stages) {
    const stage = await repository.upsertStage({
      programId: program.id,
      title: stageData.title,
      slug: stageData.slug,
      description: getStageDescription(stageData),
      position: stageData.position,
      estimatedDurationDays: stageData.estimatedDurationDays,
    });

    for (const moduleData of stageData.modules) {
      const module = await repository.upsertModule({
        stageId: stage.id,
        title: moduleData.title,
        slug: moduleData.slug,
        description: getModuleDescription(moduleData),
        position: moduleData.position,
      });

      for (const lessonData of moduleData.lessons) {
        const lesson = await repository.upsertLesson({
          moduleId: module.id,
          title: lessonData.title,
          slug: lessonData.slug,
          summary: getLessonSummary(lessonData),
          objectives: getLessonObjectives(lessonData),
          prerequisites: [],
          estimatedMinutes: lessonData.estimatedMinutes,
          position: lessonData.position,
        });

        for (const conceptData of lessonData.concepts) {
          assertRequiredConceptHasValidationActivity({
            assessmentCount: conceptData.assessment ? 1 : 0,
            isRequired: conceptData.isRequired,
          });
          const concept = await repository.upsertConcept({
            lessonId: lesson.id,
            title: conceptData.title,
            slug: conceptData.slug,
            description: conceptData.description,
            position: conceptData.position,
            isRequired: conceptData.isRequired,
            masteryThreshold: conceptData.masteryThreshold,
          });
          const assessments = conceptData.assessment
            ? [
                {
                  assessmentType: toConceptAssessmentType(
                    conceptData.assessment.type,
                  ),
                  isRequired: conceptData.isRequired,
                  position: 1,
                },
              ]
            : [];

          await repository.replaceConceptAssessments(concept.id, assessments);
        }
      }
    }
  }
}

function createSeedProgramRepository(
  client: PrismaClient,
): SeedProgramRepository {
  return {
    async replaceConceptAssessments(conceptId, assessments) {
      await client.$transaction([
        client.conceptAssessment.deleteMany({ where: { conceptId } }),
        client.conceptAssessment.createMany({
          data: assessments.map((assessment) => ({
            conceptId,
            ...assessment,
          })),
        }),
      ]);
    },
    async upsertConcept(input) {
      const { lessonId, slug, ...data } = input;

      return client.concept.upsert({
        where: { lessonId_slug: { lessonId, slug } },
        create: { lessonId, slug, ...data },
        update: data,
      });
    },
    async upsertLesson(input) {
      const { moduleId, slug, ...data } = input;

      return client.lesson.upsert({
        where: { moduleId_slug: { moduleId, slug } },
        create: { moduleId, slug, ...data },
        update: data,
      });
    },
    async upsertModule(input) {
      const { stageId, slug, ...data } = input;

      return client.module.upsert({
        where: { stageId_slug: { stageId, slug } },
        create: { stageId, slug, ...data },
        update: data,
      });
    },
    async upsertProgram(input) {
      const { ownerId, slug, ...data } = input;

      return client.program.upsert({
        where: { ownerId_slug: { ownerId, slug } },
        create: { ownerId, slug, ...data },
        update: data,
      });
    },
    async upsertStage(input) {
      const { programId, slug, ...data } = input;

      return client.stage.upsert({
        where: { programId_slug: { programId, slug } },
        create: { programId, slug, ...data },
        update: data,
      });
    },
  };
}

function getAdminEmail(environment: NodeJS.ProcessEnv = process.env): string {
  const adminEmail = environment.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL is required to seed the sample program.');
  }

  return adminEmail;
}

async function main() {
  const adminEmail = getAdminEmail();
  const { prisma } = await import('../src/server/prisma');

  try {
    const owner = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!owner) {
      throw new Error(
        `No user exists for ADMIN_EMAIL (${adminEmail}). Register this account before running the seed.`,
      );
    }

    await seedSampleProgram(
      createSeedProgramRepository(prisma),
      owner.id,
      await readSampleProgram(),
    );

    console.info('Sample program seeded successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

function isExecutedDirectly(): boolean {
  const executedFile = process.argv[1];

  return (
    Boolean(executedFile) &&
    resolve(executedFile) === fileURLToPath(import.meta.url)
  );
}

if (isExecutedDirectly()) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
