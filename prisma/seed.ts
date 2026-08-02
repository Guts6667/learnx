import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { assertRequiredConceptHasValidationActivity } from '../src/lib/concepts';

import {
  ConceptAssessmentType,
  ConceptQuestionType,
  ContentBlockType,
  ProgramStatus,
  ResourceType,
  StageAssessmentType,
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
const stageAssessmentTypeSchema = z.enum([
  'project',
  'case_study',
  'written_assignment',
  'practical_exercise',
  'oral',
  'simulation',
  'cumulative_exam',
]);
const stageAssessmentSchema = z.object({
  title: z.string().trim().min(1),
  type: stageAssessmentTypeSchema,
  isRequired: z.boolean(),
  passingScore: z.number().min(0).max(100),
  description: z.string().trim().min(1).optional(),
  instructions: z.string().trim().min(1).optional(),
  rubric: z
    .array(
      z.object({
        criterion: z.string().trim().min(1),
        weight: z.number().positive(),
        requirements: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .optional(),
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

const conceptQuestionTypeSchema = z.enum([
  'true_false',
  'single_choice',
  'multiple_choice',
  'short_answer',
]);
const conceptAssessmentOptionSchema = z.object({
  label: z.string().trim().min(1),
  isCorrect: z.boolean(),
  position: z.number().int().positive(),
});
const conceptAssessmentQuestionSchema = z.object({
  type: conceptQuestionTypeSchema,
  prompt: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  acceptedAnswers: z.array(z.string().trim().min(1)),
  position: z.number().int().positive(),
  options: z.array(conceptAssessmentOptionSchema),
});
const conceptAssessmentBankSchema = z.object({
  conceptSlug: z.string().trim().min(1),
  assessmentTitle: z.string().trim().min(1),
  questions: z.array(conceptAssessmentQuestionSchema).min(1),
});
const conceptAssessmentBankGroupSchema = z.object({
  programSlug: z.string().trim().min(1),
  stageSlug: z.string().trim().min(1),
  moduleSlug: z.string().trim().min(1),
  lessonSlug: z.string().trim().min(1),
  assessmentBanks: z.array(conceptAssessmentBankSchema).min(1),
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
  assessment: stageAssessmentSchema,
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
  conceptAssessmentBanks: z.array(conceptAssessmentBankGroupSchema).default([]),
});

export type SampleProgram = z.infer<typeof sampleProgramSchema>['program'];
export type SampleSeed = z.infer<typeof sampleProgramSchema>;

export interface SeedProgramRepository {
  deleteConceptsNotIn(lessonId: string, slugs: string[]): Promise<void>;
  deleteConceptAssessmentsNotIn(
    conceptId: string,
    positions: number[],
  ): Promise<void>;
  pruneEditorialContent(input: {
    contentBlockPositions: number[];
    lessonId: string;
    resourceKeys: string[];
    taskPositions: number[];
  }): Promise<void>;
  pruneExercises(lessonId: string, positions: number[]): Promise<void>;
  replaceConceptAssessmentQuestions(
    assessmentId: string,
    questions: Array<{
      acceptedAnswers: string[];
      explanation: string;
      options: Array<{
        isCorrect: boolean;
        label: string;
        position: number;
      }>;
      position: number;
      prompt: string;
      type: ConceptQuestionType;
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
  upsertConceptAssessment(input: {
    assessmentType: ConceptAssessmentType;
    conceptId: string;
    isRequired: boolean;
    position: number;
    questionCount: number;
    title: string;
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
  upsertExercise(input: {
    instructions: string;
    isRequired: boolean;
    lessonId: string;
    position: number;
    title: string;
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
  upsertStageAssessment(input: {
    stageId: string;
    title: string;
    type: StageAssessmentType;
    description?: string;
    instructions?: string;
    rubric?: Prisma.InputJsonValue;
    isRequired: boolean;
    passingScore: number;
    position: number;
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

function toConceptQuestionType(
  type: z.infer<typeof conceptQuestionTypeSchema>,
): ConceptQuestionType {
  return {
    multiple_choice: ConceptQuestionType.MULTIPLE_CHOICE,
    short_answer: ConceptQuestionType.SHORT_ANSWER,
    single_choice: ConceptQuestionType.SINGLE_CHOICE,
    true_false: ConceptQuestionType.TRUE_FALSE,
  }[type];
}

function toStageAssessmentType(
  type: z.infer<typeof stageAssessmentTypeSchema>,
): StageAssessmentType {
  return {
    case_study: StageAssessmentType.CASE_STUDY,
    cumulative_exam: StageAssessmentType.CUMULATIVE_EXAM,
    oral: StageAssessmentType.ORAL,
    practical_exercise: StageAssessmentType.PRACTICAL_EXERCISE,
    project: StageAssessmentType.PROJECT,
    simulation: StageAssessmentType.SIMULATION,
    written_assignment: StageAssessmentType.WRITTEN_ASSIGNMENT,
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

export async function readSampleSeed(): Promise<SampleSeed> {
  const sourcePath = resolve(process.cwd(), 'seed/sample-program.json');
  const source = await readFile(sourcePath, 'utf8');

  return sampleProgramSchema.parse(JSON.parse(source) as unknown);
}

export async function readSampleProgram(): Promise<SampleProgram> {
  return (await readSampleSeed()).program;
}

export async function seedSampleProgram(
  repository: SeedProgramRepository,
  ownerId: string,
  sampleProgram: SampleProgram,
  conceptAssessmentBankGroups: SampleSeed['conceptAssessmentBanks'] = [],
): Promise<void> {
  const assessmentBanks = new Map<
    string,
    z.infer<typeof conceptAssessmentBankSchema>
  >();

  for (const group of conceptAssessmentBankGroups) {
    for (const bank of group.assessmentBanks) {
      const key = [
        group.programSlug,
        group.stageSlug,
        group.moduleSlug,
        group.lessonSlug,
        bank.conceptSlug,
      ].join(':');

      if (assessmentBanks.has(key)) {
        throw new Error(`Duplicate assessment bank for "${key}".`);
      }

      assessmentBanks.set(key, bank);
    }
  }

  const importedAssessmentBanks = new Set<string>();
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

    await repository.upsertStageAssessment({
      stageId: stage.id,
      title: stageData.assessment.title,
      type: toStageAssessmentType(stageData.assessment.type),
      description: stageData.assessment.description,
      instructions: stageData.assessment.instructions,
      rubric: stageData.assessment.rubric,
      isRequired: stageData.assessment.isRequired,
      passingScore: stageData.assessment.passingScore,
      position: 1,
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

        if (lessonData.tasks.length > 0) {
          await repository.pruneExercises(
            lesson.id,
            lessonData.tasks.map((task) => task.position),
          );

          for (const taskData of lessonData.tasks) {
            await repository.upsertExercise({
              instructions: taskData.description ?? taskData.title,
              isRequired: taskData.isRequired,
              lessonId: lesson.id,
              position: taskData.position,
              title: taskData.title,
            });
          }
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
          await repository.deleteConceptAssessmentsNotIn(
            concept.id,
            conceptData.assessment ? [1] : [],
          );

          if (conceptData.assessment) {
            const assessment = await repository.upsertConceptAssessment({
              assessmentType: toConceptAssessmentType(
                conceptData.assessment.type,
              ),
              conceptId: concept.id,
              isRequired: conceptData.isRequired,
              position: 1,
              questionCount: conceptData.assessment.questionCount,
              title: conceptData.assessment.title,
            });
            const assessmentBankKey = [
              sampleProgram.slug,
              stageData.slug,
              moduleData.slug,
              lessonData.slug,
              conceptData.slug,
            ].join(':');
            const assessmentBank = assessmentBanks.get(assessmentBankKey);

            if (assessmentBank) {
              if (
                assessmentBank.assessmentTitle !==
                  conceptData.assessment.title ||
                assessmentBank.questions.length !==
                  conceptData.assessment.questionCount
              ) {
                throw new Error(
                  `Assessment bank does not match concept "${assessmentBankKey}".`,
                );
              }

              await repository.replaceConceptAssessmentQuestions(
                assessment.id,
                assessmentBank.questions.map((question) => ({
                  acceptedAnswers: question.acceptedAnswers,
                  explanation: question.explanation,
                  options: question.options,
                  position: question.position,
                  prompt: question.prompt,
                  type: toConceptQuestionType(question.type),
                })),
              );
              importedAssessmentBanks.add(assessmentBankKey);
            }
          }
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

  const unknownAssessmentBanks = [...assessmentBanks.keys()].filter(
    (key) => !importedAssessmentBanks.has(key),
  );

  if (unknownAssessmentBanks.length > 0) {
    throw new Error(
      `Assessment banks target unknown concepts: ${unknownAssessmentBanks.join(', ')}.`,
    );
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
    async deleteConceptAssessmentsNotIn(conceptId, positions) {
      await client.conceptAssessment.deleteMany({
        where: {
          conceptId,
          ...(positions.length > 0 ? { position: { notIn: positions } } : {}),
        },
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
    async pruneExercises(lessonId, positions) {
      await client.exercise.deleteMany({
        where: {
          lessonId,
          ...(positions.length > 0 ? { position: { notIn: positions } } : {}),
        },
      });
    },
    async replaceConceptAssessmentQuestions(assessmentId, questions) {
      await client.$transaction(async (transaction) => {
        await transaction.conceptAssessmentQuestion.deleteMany({
          where: {
            assessmentId,
            position: { notIn: questions.map((question) => question.position) },
          },
        });

        for (const question of questions) {
          const { options, ...questionData } = question;
          const storedQuestion =
            await transaction.conceptAssessmentQuestion.upsert({
              where: {
                assessmentId_position: {
                  assessmentId,
                  position: question.position,
                },
              },
              create: { ...questionData, assessmentId },
              update: questionData,
              select: { id: true },
            });

          await transaction.conceptAssessmentOption.deleteMany({
            where: {
              questionId: storedQuestion.id,
              position: { notIn: options.map((option) => option.position) },
            },
          });

          for (const option of options) {
            await transaction.conceptAssessmentOption.upsert({
              where: {
                questionId_position: {
                  position: option.position,
                  questionId: storedQuestion.id,
                },
              },
              create: { ...option, questionId: storedQuestion.id },
              update: option,
            });
          }
        }
      });
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
    async upsertConceptAssessment(input) {
      const existing = await client.conceptAssessment.findFirst({
        where: { conceptId: input.conceptId, position: input.position },
        orderBy: { id: 'asc' },
        select: { id: true },
      });

      if (!existing) {
        return client.conceptAssessment.create({
          data: input,
          select: { id: true },
        });
      }

      const [, assessment] = await client.$transaction([
        client.conceptAssessment.deleteMany({
          where: {
            conceptId: input.conceptId,
            id: { not: existing.id },
            position: input.position,
          },
        }),
        client.conceptAssessment.update({
          where: { id: existing.id },
          data: input,
          select: { id: true },
        }),
      ]);

      return assessment;
    },
    async upsertLesson(input) {
      const { moduleId, slug, ...data } = input;

      return client.lesson.upsert({
        where: { moduleId_slug: { moduleId, slug } },
        create: { moduleId, slug, ...data },
        update: data,
      });
    },
    async upsertExercise(input) {
      const { lessonId, position, ...data } = input;

      return client.exercise.upsert({
        where: { lessonId_position: { lessonId, position } },
        create: { lessonId, position, ...data },
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
    async upsertStageAssessment(input) {
      const { stageId, position, ...data } = input;

      return client.stageAssessment.upsert({
        where: { stageId_position: { stageId, position } },
        create: { stageId, position, ...data },
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

    const sampleSeed = await readSampleSeed();

    await seedSampleProgram(
      createSeedProgramRepository(prisma),
      owner.id,
      sampleSeed.program,
      sampleSeed.conceptAssessmentBanks,
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
