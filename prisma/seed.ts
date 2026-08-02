import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { assertRequiredConceptHasValidationActivity } from '../src/lib/concepts';

import {
  ConceptAssessmentType,
  ContentBlockType,
  ProgramStatus,
  ResourceType,
  TaskType,
  type Prisma,
  type PrismaClient,
} from '../generated/prisma/client';

const programStatusSchema = z.enum(['draft', 'active', 'archived']);
const contentBlockTypeSchema = z.enum([
  'rich_text',
  'objective',
  'definition',
  'example',
  'callout',
  'quote',
  'embed',
  'divider',
]);
const resourceTypeSchema = z.enum([
  'book',
  'book_chapter',
  'article',
  'video',
  'course',
  'podcast',
  'website',
  'document',
  'tool',
]);
const taskTypeSchema = z.enum([
  'reading',
  'watching',
  'listening',
  'reflection',
  'checklist',
  'writing',
  'practice',
  'project',
]);
const conceptAssessmentTypeSchema = z.enum([
  'quiz',
  'short_answer',
  'practice',
  'flashcard',
  'case_question',
]);
const conceptAssessmentSchema = z.object({
  type: conceptAssessmentTypeSchema,
  title: z.string().trim().min(1),
  questionCount: z.number().int().positive(),
});
const conceptSchema = z
  .object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    position: z.number().int().nonnegative(),
    isRequired: z.boolean().default(true),
    masteryThreshold: z.number().min(0).max(100).default(70),
    resourceKeys: z.array(z.string().trim().min(1)).default([]),
    assessment: conceptAssessmentSchema.optional(),
  })
  .refine((concept) => !concept.isRequired || concept.assessment, {
    message: 'A required concept must define a validation activity.',
    path: ['assessment'],
  });

const contentBlockSchema = z.object({
  type: contentBlockTypeSchema,
  position: z.number().int().positive(),
  content: z.object({ text: z.string().trim().min(1) }),
});

const resourceSchema = z.object({
  key: z.string().trim().min(1),
  type: resourceTypeSchema,
  title: z.string().trim().min(1),
  author: z.string().trim().min(1).optional(),
  url: z.url(),
  citation: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  isRequired: z.boolean(),
  estimatedMinutes: z.number().int().positive().optional(),
  position: z.number().int().positive(),
});

const taskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  type: taskTypeSchema,
  isRequired: z.boolean(),
  weight: z.number().positive(),
  position: z.number().int().positive(),
});

const lessonSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  objectives: z.array(z.string().trim().min(1)).optional(),
  prerequisites: z.array(z.string().trim().min(1)).default([]),
  position: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive().optional(),
  contentBlocks: z.array(contentBlockSchema).default([]),
  resources: z.array(resourceSchema).default([]),
  concepts: z.array(conceptSchema).default([]),
  tasks: z.array(taskSchema).default([]),
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
  deleteConceptsNotIn(lessonId: string, slugs: string[]): Promise<void>;
  pruneEditorialContent(input: {
    contentBlockPositions: number[];
    lessonId: string;
    resourceKeys: string[];
    taskPositions: number[];
  }): Promise<void>;
  replaceConceptAssessments(
    conceptId: string,
    assessments: Array<{
      assessmentType: ConceptAssessmentType;
      isRequired: boolean;
      position: number;
      questionCount: number;
      title: string;
    }>,
  ): Promise<void>;
  replaceConceptResources(
    conceptId: string,
    resourceIds: string[],
  ): Promise<void>;
  upsertContentBlock(input: {
    content: Prisma.InputJsonValue;
    lessonId: string;
    position: number;
    type: ContentBlockType;
  }): Promise<{ id: string }>;
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
  upsertResource(input: {
    author?: string;
    citation?: string;
    description?: string;
    estimatedMinutes?: number;
    isRequired: boolean;
    key: string;
    lessonId: string;
    position: number;
    title: string;
    type: ResourceType;
    url: string;
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
  upsertTask(input: {
    description?: string;
    isRequired: boolean;
    lessonId: string;
    position: number;
    title: string;
    type: TaskType;
    weight: number;
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

function toContentBlockType(
  type: z.infer<typeof contentBlockTypeSchema>,
): ContentBlockType {
  return {
    callout: ContentBlockType.CALLOUT,
    definition: ContentBlockType.DEFINITION,
    divider: ContentBlockType.DIVIDER,
    embed: ContentBlockType.EMBED,
    example: ContentBlockType.EXAMPLE,
    objective: ContentBlockType.OBJECTIVE,
    quote: ContentBlockType.QUOTE,
    rich_text: ContentBlockType.RICH_TEXT,
  }[type];
}

function toResourceType(
  type: z.infer<typeof resourceTypeSchema>,
): ResourceType {
  return {
    article: ResourceType.ARTICLE,
    book: ResourceType.BOOK,
    book_chapter: ResourceType.BOOK_CHAPTER,
    course: ResourceType.COURSE,
    document: ResourceType.DOCUMENT,
    podcast: ResourceType.PODCAST,
    tool: ResourceType.TOOL,
    video: ResourceType.VIDEO,
    website: ResourceType.WEBSITE,
  }[type];
}

function toTaskType(type: z.infer<typeof taskTypeSchema>): TaskType {
  return {
    checklist: TaskType.CHECKLIST,
    listening: TaskType.LISTENING,
    practice: TaskType.PRACTICE,
    project: TaskType.PROJECT,
    reading: TaskType.READING,
    reflection: TaskType.REFLECTION,
    watching: TaskType.WATCHING,
    writing: TaskType.WRITING,
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
  return lesson.objectives ?? lesson.concepts.map((concept) => concept.title);
}

function getLessonSummary(lesson: z.infer<typeof lessonSchema>): string {
  if (lesson.summary) {
    return lesson.summary;
  }

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
          prerequisites: lessonData.prerequisites,
          estimatedMinutes: lessonData.estimatedMinutes,
          position: lessonData.position,
        });

        const hasEditorialContent =
          lessonData.contentBlocks.length > 0 ||
          lessonData.resources.length > 0 ||
          lessonData.tasks.length > 0;

        if (hasEditorialContent) {
          await repository.pruneEditorialContent({
            contentBlockPositions: lessonData.contentBlocks.map(
              (block) => block.position,
            ),
            lessonId: lesson.id,
            resourceKeys: lessonData.resources.map((resource) => resource.key),
            taskPositions: lessonData.tasks.map((task) => task.position),
          });
        }

        for (const blockData of lessonData.contentBlocks) {
          await repository.upsertContentBlock({
            content: blockData.content,
            lessonId: lesson.id,
            position: blockData.position,
            type: toContentBlockType(blockData.type),
          });
        }

        const resourceIdsByKey = new Map<string, string>();

        for (const resourceData of lessonData.resources) {
          const resource = await repository.upsertResource({
            author: resourceData.author,
            citation: resourceData.citation,
            description: resourceData.description,
            estimatedMinutes: resourceData.estimatedMinutes,
            isRequired: resourceData.isRequired,
            key: resourceData.key,
            lessonId: lesson.id,
            position: resourceData.position,
            title: resourceData.title,
            type: toResourceType(resourceData.type),
            url: resourceData.url,
          });

          resourceIdsByKey.set(resourceData.key, resource.id);
        }

        for (const taskData of lessonData.tasks) {
          await repository.upsertTask({
            description: taskData.description,
            isRequired: taskData.isRequired,
            lessonId: lesson.id,
            position: taskData.position,
            title: taskData.title,
            type: toTaskType(taskData.type),
            weight: taskData.weight,
          });
        }

        await repository.deleteConceptsNotIn(
          lesson.id,
          lessonData.concepts.map((concept) => concept.slug),
        );

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
                  questionCount: conceptData.assessment.questionCount,
                  title: conceptData.assessment.title,
                },
              ]
            : [];

          await repository.replaceConceptAssessments(concept.id, assessments);
          const resourceIds = conceptData.resourceKeys.map((resourceKey) => {
            const resourceId = resourceIdsByKey.get(resourceKey);

            if (!resourceId) {
              throw new Error(
                `Unknown resource key "${resourceKey}" for concept "${conceptData.slug}".`,
              );
            }

            return resourceId;
          });

          await repository.replaceConceptResources(concept.id, resourceIds);
        }
      }
    }
  }
}

function createSeedProgramRepository(
  client: PrismaClient,
): SeedProgramRepository {
  return {
    async deleteConceptsNotIn(lessonId, slugs) {
      await client.concept.deleteMany({
        where: { lessonId, slug: { notIn: slugs } },
      });
    },
    async pruneEditorialContent(input) {
      await client.$transaction([
        client.contentBlock.deleteMany({
          where: {
            lessonId: input.lessonId,
            position: { notIn: input.contentBlockPositions },
          },
        }),
        client.resource.deleteMany({
          where: {
            lessonId: input.lessonId,
            OR: [{ key: null }, { key: { notIn: input.resourceKeys } }],
          },
        }),
        client.task.deleteMany({
          where: {
            lessonId: input.lessonId,
            position: { notIn: input.taskPositions },
          },
        }),
      ]);
    },
    async replaceConceptAssessments(conceptId, assessments) {
      if (assessments.length === 0) {
        await client.conceptAssessment.deleteMany({ where: { conceptId } });
        return;
      }

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
    async replaceConceptResources(conceptId, resourceIds) {
      if (resourceIds.length === 0) {
        await client.conceptResource.deleteMany({ where: { conceptId } });
        return;
      }

      await client.$transaction([
        client.conceptResource.deleteMany({ where: { conceptId } }),
        client.conceptResource.createMany({
          data: resourceIds.map((resourceId) => ({ conceptId, resourceId })),
        }),
      ]);
    },
    async upsertContentBlock(input) {
      const { lessonId, position, ...data } = input;

      return client.contentBlock.upsert({
        where: { lessonId_position: { lessonId, position } },
        create: { lessonId, position, ...data },
        update: data,
      });
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
    async upsertResource(input) {
      const { key, lessonId, ...data } = input;

      return client.resource.upsert({
        where: { lessonId_key: { key, lessonId } },
        create: { key, lessonId, ...data },
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
    async upsertTask(input) {
      const { lessonId, position, ...data } = input;

      return client.task.upsert({
        where: { lessonId_position: { lessonId, position } },
        create: { lessonId, position, ...data },
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
