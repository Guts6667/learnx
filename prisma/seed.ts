import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import {
  belongsToCurrentModuleRun,
  getCanonicalActivityKind,
} from '../src/lib/canonical-activities';
import { assertRequiredConceptHasValidationActivity } from '../src/lib/concepts';

import {
  CanonicalActivityKind,
  ConceptAssessmentType,
  ConceptQuestionType,
  ContentBlockType,
  LessonSequenceKind,
  ProgramStatus,
  QuizQuestionType,
  ResourceType,
  StageAssessmentType,
  TaskType,
  type Prisma,
} from '../generated/prisma/client';

export const SAMPLE_PROGRAM_SEED_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 10 * 60_000,
} as const;

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
  key: z.string().trim().min(1),
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
  key: z.string().trim().min(1),
  type: contentBlockTypeSchema,
  position: z.number().int().positive(),
  content: z.object({
    text: z.string().trim().min(1),
    sourceKeys: z.array(z.string().trim().min(1)).default([]),
  }),
});

const resourceSchema = z.object({
  key: z.string().trim().min(1),
  type: resourceTypeSchema,
  title: z.string().trim().min(1),
  author: z.string().trim().min(1).optional(),
  url: z.url(),
  citation: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  guidance: z
    .object({
      accessibilityNotes: z.string().trim().min(1).optional(),
      alternativeResourceKey: z.string().trim().min(1).nullable().optional(),
      instructions: z.string().trim().min(1),
      objective: z.string().trim().min(1),
      scope: z.string().trim().min(1).nullable().optional(),
      urlStatus: z.enum(['ok', 'redirect', 'restricted', 'broken']),
    })
    .optional(),
  isRequired: z.boolean(),
  estimatedMinutes: z.number().int().positive().optional(),
  position: z.number().int().positive(),
});

const taskSchema = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  type: taskTypeSchema,
  isRequired: z.boolean(),
  weight: z.number().positive(),
  position: z.number().int().positive(),
  resourceKeys: z.array(z.string().trim().min(1)).default([]),
});

const lessonSequenceKindSchema = z.enum([
  'CONTENT',
  'RESOURCE',
  'TASK',
  'CONCEPT_ASSESSMENT',
  'EXERCISE',
  'QUIZ',
]);

const lessonSequenceItemSchema = z.object({
  kind: lessonSequenceKindSchema,
  key: z.string().trim().min(1),
});
const quizQuestionTypeSchema = z.enum([
  'true_false',
  'single_choice',
  'multiple_choice',
  'short_answer',
]);
const quizQuestionSchema = z.object({
  type: quizQuestionTypeSchema,
  prompt: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  acceptedAnswers: z.array(z.string().trim().min(1)).default([]),
  position: z.number().int().positive(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        isCorrect: z.boolean(),
        position: z.number().int().positive(),
      }),
    )
    .default([]),
});
const quizSchema = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  passingScore: z.number().min(0).max(100).default(70),
  isRequired: z.boolean().default(true),
  position: z.number().int().positive(),
  questions: z.array(quizQuestionSchema).min(1),
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
  canonicalKey: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  objectives: z.array(z.string().trim().min(1)).optional(),
  prerequisites: z.array(z.string().trim().min(1)).default([]),
  position: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive().optional(),
  contentBlocks: z.array(contentBlockSchema).default([]),
  resources: z.array(resourceSchema).default([]),
  concepts: z.array(conceptSchema).default([]),
  tasks: z.array(taskSchema).default([]),
  quizzes: z.array(quizSchema).default([]),
  sequence: z.array(lessonSequenceItemSchema),
});

const moduleSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  canonicalKey: z.string().trim().min(1).optional(),
  position: z.number().int().nonnegative(),
  lessons: z.array(lessonSchema),
});

const stageSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  canonicalKey: z.string().trim().min(1).optional(),
  position: z.number().int().nonnegative(),
  estimatedDurationDays: z.number().int().positive().optional(),
  assessment: stageAssessmentSchema,
  modules: z.array(moduleSchema),
});

const sampleProgramSchema = z.object({
  program: z.object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    canonicalProgramKey: z.string().trim().min(1).optional(),
    locale: z.enum(['fr', 'en']).default('fr'),
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
    contentBlockKeys: string[];
    lessonId: string;
    resourceKeys: string[];
  }): Promise<void>;
  prepareLessonSequenceUpdate(input: {
    lessonId: string;
    references: Array<{ key: string; kind: LessonSequenceKind }>;
  }): Promise<void>;
  pruneCanonicalActivities(input: {
    exerciseKeys: string[];
    lessonId: string;
    taskKeys: string[];
  }): Promise<void>;
  pruneQuizzes(lessonId: string, keys: string[]): Promise<void>;
  archiveExerciseMirror(input: {
    activityType: TaskType;
    key: string;
    lessonId: string;
    position: number;
  }): Promise<void>;
  archiveTaskMirror(input: {
    key: string;
    lessonId: string;
    position: number;
    type: TaskType;
  }): Promise<void>;
  replaceTaskResources(taskId: string, resourceIds: string[]): Promise<void>;
  syncActivityCarryovers(input: {
    kind: CanonicalActivityKind;
    key: string;
    lessonId: string;
    resourceIds: string[];
  }): Promise<void>;
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
  replaceQuizQuestions(
    quizId: string,
    questions: Array<{
      acceptedAnswers: string[];
      explanation: string;
      options: Array<{ isCorrect: boolean; label: string; position: number }>;
      position: number;
      prompt: string;
      type: QuizQuestionType;
    }>,
  ): Promise<void>;
  replaceConceptResources(
    conceptId: string,
    resourceIds: string[],
  ): Promise<void>;
  upsertContentBlock(input: {
    content: Prisma.InputJsonValue;
    lessonId: string;
    key: string;
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
    key: string;
    lessonId: string;
    isRequired: boolean;
    position: number;
    questionCount: number;
    title: string;
  }): Promise<{ id: string }>;
  replaceLessonSequence(input: {
    items: Array<{
      key: string;
      kind: LessonSequenceKind;
      targetId: string;
    }>;
    lessonId: string;
  }): Promise<void>;
  upsertLesson(input: {
    moduleId: string;
    canonicalKey: string;
    title: string;
    slug: string;
    summary: string;
    objectives: Prisma.InputJsonValue;
    prerequisites: Prisma.InputJsonValue;
    estimatedMinutes?: number;
    position: number;
  }): Promise<{ id: string }>;
  upsertExercise(input: {
    activityType: TaskType;
    instructions: string;
    isRequired: boolean;
    key: string;
    lessonId: string;
    position: number;
    title: string;
  }): Promise<{ id: string }>;
  upsertModule(input: {
    stageId: string;
    canonicalKey: string;
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
    guidance?: Prisma.InputJsonValue;
    isRequired: boolean;
    key: string;
    lessonId: string;
    position: number;
    title: string;
    type: ResourceType;
    url: string;
  }): Promise<{ id: string }>;
  upsertQuiz(input: {
    description?: string;
    isRequired: boolean;
    key: string;
    lessonId: string;
    passingScore: number;
    position: number;
    title: string;
  }): Promise<{ id: string }>;
  upsertProgram(input: {
    ownerId: string;
    canonicalProgramKey: string;
    locale: 'fr' | 'en';
    title: string;
    slug: string;
    description: string;
    status: ProgramStatus;
    position: number;
    estimatedDurationDays?: number;
  }): Promise<{ id: string }>;
  upsertStage(input: {
    programId: string;
    canonicalKey: string;
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
    key: string;
    lessonId: string;
    position: number;
    title: string;
    type: TaskType;
    weight: number;
  }): Promise<{ id: string }>;
}

function isPassiveTask(type: z.infer<typeof taskTypeSchema>): boolean {
  return getCanonicalActivityKind(type) === 'TASK';
}

function getActivityKey(task: z.infer<typeof taskSchema>): string {
  return task.key;
}

function toLessonSequenceKind(
  kind: z.infer<typeof lessonSequenceKindSchema>,
): LessonSequenceKind {
  return {
    CONCEPT_ASSESSMENT: LessonSequenceKind.CONCEPT_ASSESSMENT,
    CONTENT: LessonSequenceKind.CONTENT,
    EXERCISE: LessonSequenceKind.EXERCISE,
    QUIZ: LessonSequenceKind.QUIZ,
    RESOURCE: LessonSequenceKind.RESOURCE,
    TASK: LessonSequenceKind.TASK,
  }[kind];
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

function toQuizQuestionType(
  type: z.infer<typeof quizQuestionTypeSchema>,
): QuizQuestionType {
  return {
    multiple_choice: QuizQuestionType.MULTIPLE_CHOICE,
    short_answer: QuizQuestionType.SHORT_ANSWER,
    single_choice: QuizQuestionType.SINGLE_CHOICE,
    true_false: QuizQuestionType.TRUE_FALSE,
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

async function readSeedFile(relativePath: string): Promise<SampleSeed> {
  const sourcePath = resolve(process.cwd(), relativePath);
  const source = await readFile(sourcePath, 'utf8');

  return sampleProgramSchema.parse(JSON.parse(source) as unknown);
}

export async function readSampleSeed(): Promise<SampleSeed> {
  return readSeedFile('seed/sample-program.json');
}

export async function readOfficineExpressSeed(): Promise<SampleSeed> {
  return readSeedFile('seed/officine-express-program.json');
}

export async function readPlatformApmInterviewSeed(): Promise<SampleSeed> {
  return readSeedFile('seed/platform-apm-interview-program.json');
}

export async function readPilotageProjetsIaSeed(): Promise<SampleSeed> {
  return readSeedFile('seed/pilotage-projets-ia-iso-42001-program.json');
}

export async function readPsychologyFoundationsPilotSeed(): Promise<SampleSeed> {
  return readSeedFile('seed/psychology-foundations-pilot-program.json');
}

export async function readSampleProgram(): Promise<SampleProgram> {
  return (await readSampleSeed()).program;
}

const seedDefinitions = [
  {
    read: readSampleSeed,
    slug: 'fondamentaux-psychologie',
  },
  {
    read: readOfficineExpressSeed,
    slug: 'officine-express',
  },
  {
    read: readPlatformApmInterviewSeed,
    slug: 'platform-apm-entretien-tryhackme',
  },
  {
    read: readPilotageProjetsIaSeed,
    slug: 'pilotage-projets-ia-iso-42001',
  },
  {
    read: readPsychologyFoundationsPilotSeed,
    slug: 'psychology-foundations-pilot',
  },
] as const;

export function getSelectedSeedSlugs(
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  const requestedSlug = environment.LEARNX_SEED_PROGRAM_SLUG?.trim();

  if (!requestedSlug) {
    return seedDefinitions.map(({ slug }) => slug);
  }

  if (!seedDefinitions.some(({ slug }) => slug === requestedSlug)) {
    throw new Error(
      `Unsupported LEARNX_SEED_PROGRAM_SLUG ("${requestedSlug}").`,
    );
  }

  return [requestedSlug];
}

async function readSelectedSeeds(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<SampleSeed[]> {
  const selectedSlugs = new Set(getSelectedSeedSlugs(environment));

  return Promise.all(
    seedDefinitions
      .filter(({ slug }) => selectedSlugs.has(slug))
      .map(({ read }) => read()),
  );
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
    canonicalProgramKey:
      sampleProgram.canonicalProgramKey ?? sampleProgram.slug,
    locale: sampleProgram.locale,
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
      canonicalKey: stageData.canonicalKey ?? stageData.slug,
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
        canonicalKey: moduleData.canonicalKey ?? moduleData.slug,
        title: moduleData.title,
        slug: moduleData.slug,
        description: getModuleDescription(moduleData),
        position: moduleData.position,
      });

      for (const lessonData of moduleData.lessons) {
        const lessonResourceKeys = new Set(
          lessonData.resources.map((resource) => resource.key),
        );
        const missingSourceKeys = lessonData.contentBlocks.flatMap((block) =>
          block.content.sourceKeys.filter(
            (sourceKey) => !lessonResourceKeys.has(sourceKey),
          ),
        );
        const missingTaskResourceKeys = lessonData.tasks.flatMap((task) =>
          task.resourceKeys.filter(
            (resourceKey) => !lessonResourceKeys.has(resourceKey),
          ),
        );

        if (missingSourceKeys.length > 0) {
          throw new Error(
            `Content blocks for "${lessonData.slug}" reference unknown resources: ${[...new Set(missingSourceKeys)].join(', ')}.`,
          );
        }
        if (missingTaskResourceKeys.length > 0) {
          throw new Error(
            `Tasks for "${lessonData.slug}" reference unknown resources: ${[...new Set(missingTaskResourceKeys)].join(', ')}.`,
          );
        }

        const lesson = await repository.upsertLesson({
          moduleId: module.id,
          canonicalKey: lessonData.canonicalKey ?? lessonData.slug,
          title: lessonData.title,
          slug: lessonData.slug,
          summary: getLessonSummary(lessonData),
          objectives: getLessonObjectives(lessonData),
          prerequisites: lessonData.prerequisites,
          estimatedMinutes: lessonData.estimatedMinutes,
          position: lessonData.position,
        });
        await repository.prepareLessonSequenceUpdate({
          lessonId: lesson.id,
          references: lessonData.sequence.map((item) => ({
            key: item.key,
            kind: toLessonSequenceKind(item.kind),
          })),
        });
        const sequenceTargets = new Map<
          string,
          { kind: LessonSequenceKind; targetId: string }
        >();

        const hasEditorialContent =
          lessonData.contentBlocks.length > 0 ||
          lessonData.resources.length > 0 ||
          lessonData.tasks.length > 0;

        if (hasEditorialContent) {
          await repository.pruneEditorialContent({
            contentBlockKeys: lessonData.contentBlocks.map(
              (block) => block.key,
            ),
            lessonId: lesson.id,
            resourceKeys: lessonData.resources.map((resource) => resource.key),
          });
        }

        for (const blockData of lessonData.contentBlocks) {
          const block = await repository.upsertContentBlock({
            content: blockData.content,
            key: blockData.key,
            lessonId: lesson.id,
            position: blockData.position,
            type: toContentBlockType(blockData.type),
          });
          sequenceTargets.set(`CONTENT:${blockData.key}`, {
            kind: LessonSequenceKind.CONTENT,
            targetId: block.id,
          });
        }

        const resourceIdsByKey = new Map<string, string>();

        for (const resourceData of lessonData.resources) {
          const resource = await repository.upsertResource({
            author: resourceData.author,
            citation: resourceData.citation,
            description: resourceData.description,
            estimatedMinutes: resourceData.estimatedMinutes,
            guidance: resourceData.guidance,
            isRequired: resourceData.isRequired,
            key: resourceData.key,
            lessonId: lesson.id,
            position: resourceData.position,
            title: resourceData.title,
            type: toResourceType(resourceData.type),
            url: resourceData.url,
          });

          resourceIdsByKey.set(resourceData.key, resource.id);
          sequenceTargets.set(`RESOURCE:${resourceData.key}`, {
            kind: LessonSequenceKind.RESOURCE,
            targetId: resource.id,
          });
        }

        const taskKeys = lessonData.tasks
          .filter((task) => isPassiveTask(task.type))
          .map(getActivityKey);
        const exerciseKeys = lessonData.tasks
          .filter((task) => !isPassiveTask(task.type))
          .map(getActivityKey);
        await repository.pruneCanonicalActivities({
          exerciseKeys,
          lessonId: lesson.id,
          taskKeys,
        });
        if (lessonData.quizzes.length > 0) {
          await repository.pruneQuizzes(
            lesson.id,
            lessonData.quizzes.map((quiz) => quiz.key),
          );
        }

        for (const taskData of lessonData.tasks) {
          const activityType = toTaskType(taskData.type);
          const activityKey = getActivityKey(taskData);
          const resourceIds = taskData.resourceKeys.map((resourceKey) => {
            const resourceId = resourceIdsByKey.get(resourceKey);
            if (!resourceId) {
              throw new Error(
                `Unknown resource key "${resourceKey}" for activity "${activityKey}".`,
              );
            }
            return resourceId;
          });

          if (isPassiveTask(taskData.type)) {
            const task = await repository.upsertTask({
              description: taskData.description,
              isRequired: taskData.isRequired,
              key: activityKey,
              lessonId: lesson.id,
              position: taskData.position,
              title: taskData.title,
              type: activityType,
              weight: taskData.weight,
            });
            await repository.replaceTaskResources(task.id, resourceIds);
            await repository.archiveExerciseMirror({
              activityType,
              key: activityKey,
              lessonId: lesson.id,
              position: taskData.position,
            });
            await repository.syncActivityCarryovers({
              key: activityKey,
              kind: CanonicalActivityKind.TASK,
              lessonId: lesson.id,
              resourceIds,
            });
            sequenceTargets.set(`TASK:${activityKey}`, {
              kind: LessonSequenceKind.TASK,
              targetId: task.id,
            });
            continue;
          }

          const exercise = await repository.upsertExercise({
            activityType,
            instructions: taskData.description ?? taskData.title,
            isRequired: taskData.isRequired,
            key: activityKey,
            lessonId: lesson.id,
            position: taskData.position,
            title: taskData.title,
          });
          await repository.archiveTaskMirror({
            key: activityKey,
            lessonId: lesson.id,
            position: taskData.position,
            type: activityType,
          });
          await repository.syncActivityCarryovers({
            key: activityKey,
            kind: CanonicalActivityKind.EXERCISE,
            lessonId: lesson.id,
            resourceIds: [],
          });
          sequenceTargets.set(`EXERCISE:${activityKey}`, {
            kind: LessonSequenceKind.EXERCISE,
            targetId: exercise.id,
          });
        }

        for (const quizData of lessonData.quizzes) {
          const quiz = await repository.upsertQuiz({
            description: quizData.description,
            isRequired: quizData.isRequired,
            key: quizData.key,
            lessonId: lesson.id,
            passingScore: quizData.passingScore,
            position: quizData.position,
            title: quizData.title,
          });
          await repository.replaceQuizQuestions(
            quiz.id,
            quizData.questions.map((question) => ({
              acceptedAnswers: question.acceptedAnswers,
              explanation: question.explanation,
              options: question.options,
              position: question.position,
              prompt: question.prompt,
              type: toQuizQuestionType(question.type),
            })),
          );
          sequenceTargets.set(`QUIZ:${quizData.key}`, {
            kind: LessonSequenceKind.QUIZ,
            targetId: quiz.id,
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
              key: conceptData.assessment.key,
              lessonId: lesson.id,
              isRequired: conceptData.isRequired,
              position: 1,
              questionCount: conceptData.assessment.questionCount,
              title: conceptData.assessment.title,
            });
            sequenceTargets.set(
              `CONCEPT_ASSESSMENT:${conceptData.assessment.key}`,
              {
                kind: LessonSequenceKind.CONCEPT_ASSESSMENT,
                targetId: assessment.id,
              },
            );
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

        const seenSequenceReferences = new Set<string>();
        const sequenceItems = lessonData.sequence.map((item) => {
          const reference = `${item.kind}:${item.key}`;
          if (seenSequenceReferences.has(reference)) {
            throw new Error(
              `Duplicate lesson sequence reference "${reference}" for "${lessonData.slug}".`,
            );
          }
          seenSequenceReferences.add(reference);
          const target = sequenceTargets.get(reference);
          if (!target) {
            throw new Error(
              `Unknown lesson sequence reference "${reference}" for "${lessonData.slug}".`,
            );
          }
          return { key: item.key, ...target };
        });
        const missingTargets = [...sequenceTargets.keys()].filter(
          (reference) =>
            !reference.startsWith('RESOURCE:') &&
            !seenSequenceReferences.has(reference),
        );
        if (missingTargets.length > 0) {
          throw new Error(
            `Lesson sequence for "${lessonData.slug}" omits canonical activities: ${missingTargets.join(', ')}.`,
          );
        }
        await repository.replaceLessonSequence({
          items: sequenceItems,
          lessonId: lesson.id,
        });
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

async function neutralizeObsoleteSequencePointers(
  client: Prisma.TransactionClient,
  input: {
    lessonId: string;
    references: Array<{ key: string; kind: LessonSequenceKind }>;
  },
): Promise<void> {
  const obsoleteItems = await client.lessonSequenceItem.findMany({
    where: {
      lessonId: input.lessonId,
      NOT: input.references.length > 0 ? { OR: input.references } : undefined,
    },
    select: { id: true },
  });
  if (obsoleteItems.length === 0) return;

  await client.lessonProgress.updateMany({
    where: {
      lessonId: input.lessonId,
      currentSequenceItemId: {
        in: obsoleteItems.map((item) => item.id),
      },
    },
    data: { currentSequenceItemId: null },
  });
}

export function createSeedProgramRepository(
  client: Prisma.TransactionClient,
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
      await client.contentBlock.deleteMany({
        where: {
          lessonId: input.lessonId,
          key: { notIn: input.contentBlockKeys },
        },
      });
      await client.resource.deleteMany({
        where: {
          lessonId: input.lessonId,
          key: { notIn: input.resourceKeys },
        },
      });
    },
    async pruneCanonicalActivities({ exerciseKeys, lessonId, taskKeys }) {
      await client.task.updateMany({
        where: {
          isCanonical: true,
          lessonId,
          ...(taskKeys.length > 0 ? { key: { notIn: taskKeys } } : {}),
        },
        data: { isCanonical: false },
      });
      await client.exercise.updateMany({
        where: {
          isCanonical: true,
          lessonId,
          ...(exerciseKeys.length > 0 ? { key: { notIn: exerciseKeys } } : {}),
        },
        data: { isCanonical: false },
      });
    },
    async pruneQuizzes(lessonId, keys) {
      await client.quiz.deleteMany({
        where: { lessonId, key: { notIn: keys } },
      });
    },
    async prepareLessonSequenceUpdate(input) {
      await neutralizeObsoleteSequencePointers(client, input);
    },
    async archiveExerciseMirror(input) {
      await client.exercise.updateMany({
        where: { lessonId: input.lessonId, position: input.position },
        data: {
          activityType: input.activityType,
          isCanonical: false,
          key: input.key,
        },
      });
    },
    async archiveTaskMirror(input) {
      await client.task.updateMany({
        where: { lessonId: input.lessonId, position: input.position },
        data: { isCanonical: false, key: input.key, type: input.type },
      });
    },
    async replaceTaskResources(taskId, resourceIds) {
      await client.taskResource.deleteMany({ where: { taskId } });
      if (resourceIds.length > 0) {
        await client.taskResource.createMany({
          data: resourceIds.map((resourceId) => ({ resourceId, taskId })),
        });
      }
    },
    async syncActivityCarryovers(input) {
      const lesson = await client.lesson.findUnique({
        where: { id: input.lessonId },
        select: { moduleId: true },
      });
      if (!lesson) return;

      const [taskCompletions, exerciseSubmissions, resourceProgresses] =
        await Promise.all([
          client.taskCompletion.findMany({
            where: {
              status: 'DONE',
              task: {
                isCanonical: false,
                key: input.key,
                lessonId: input.lessonId,
              },
            },
            select: { completedAt: true, id: true, userId: true },
          }),
          client.exerciseSubmission.findMany({
            where: {
              status: 'SUBMITTED',
              exercise: {
                isCanonical: false,
                key: input.key,
                lessonId: input.lessonId,
              },
            },
            select: {
              id: true,
              moduleRunId: true,
              submittedAt: true,
              userId: true,
            },
          }),
          input.resourceIds.length > 0
            ? client.resourceProgress.findMany({
                where: {
                  resourceId: { in: input.resourceIds },
                  status: 'COMPLETED',
                },
                select: { completedAt: true, id: true, userId: true },
              })
            : [],
        ]);
      const userIds = [
        ...new Set([
          ...taskCompletions.map((item) => item.userId),
          ...exerciseSubmissions.map((item) => item.userId),
          ...resourceProgresses.map((item) => item.userId),
        ]),
      ];
      if (userIds.length === 0) return;
      const runs = await client.moduleRun.findMany({
        where: { moduleId: lesson.moduleId, userId: { in: userIds } },
        orderBy: [{ userId: 'asc' }, { sequence: 'desc' }],
        select: { id: true, startedAt: true, userId: true },
      });
      const currentRunByUser = new Map<
        string,
        { id: string; startedAt: Date }
      >();
      for (const run of runs) {
        if (!currentRunByUser.has(run.userId)) {
          currentRunByUser.set(run.userId, run);
        }
      }

      for (const userId of userIds) {
        const currentRun = currentRunByUser.get(userId);
        if (!currentRun) continue;
        const moduleRunId = currentRun.id;
        const sourceTaskIds = taskCompletions
          .filter(
            (item) =>
              item.userId === userId &&
              belongsToCurrentModuleRun(item.completedAt, currentRun.startedAt),
          )
          .map((item) => item.id);
        const sourceExerciseIds = exerciseSubmissions
          .filter(
            (item) =>
              item.userId === userId && item.moduleRunId === moduleRunId,
          )
          .map((item) => item.id);
        const sourceResourceIds = resourceProgresses
          .filter(
            (item) =>
              item.userId === userId &&
              belongsToCurrentModuleRun(item.completedAt, currentRun.startedAt),
          )
          .map((item) => item.id);
        if (
          sourceTaskIds.length === 0 &&
          sourceExerciseIds.length === 0 &&
          sourceResourceIds.length === 0
        ) {
          continue;
        }
        const dates = [
          ...taskCompletions
            .filter(
              (item) =>
                item.userId === userId &&
                belongsToCurrentModuleRun(
                  item.completedAt,
                  currentRun.startedAt,
                ),
            )
            .map((item) => item.completedAt),
          ...exerciseSubmissions
            .filter(
              (item) =>
                item.userId === userId && item.moduleRunId === moduleRunId,
            )
            .map((item) => item.submittedAt),
          ...resourceProgresses
            .filter(
              (item) =>
                item.userId === userId &&
                belongsToCurrentModuleRun(
                  item.completedAt,
                  currentRun.startedAt,
                ),
            )
            .map((item) => item.completedAt),
        ].filter((date): date is Date => date !== null);
        const completedAt =
          dates.sort((left, right) => right.getTime() - left.getTime())[0] ??
          new Date(0);
        const sources = {
          exerciseSubmissionIds: sourceExerciseIds,
          resourceProgressIds: sourceResourceIds,
          taskCompletionIds: sourceTaskIds,
        } satisfies Prisma.InputJsonObject;
        await client.activityCompletionCarryover.upsert({
          where: {
            userId_lessonId_activityKey_kind_moduleRunId: {
              activityKey: input.key,
              kind: input.kind,
              lessonId: input.lessonId,
              moduleRunId,
              userId,
            },
          },
          create: {
            activityKey: input.key,
            completedAt,
            kind: input.kind,
            lessonId: input.lessonId,
            moduleRunId,
            sources,
            userId,
          },
          update: { completedAt, sources },
        });
      }
    },
    async replaceConceptAssessmentQuestions(assessmentId, questions) {
      await client.conceptAssessmentQuestion.deleteMany({
        where: {
          assessmentId,
          position: { notIn: questions.map((question) => question.position) },
        },
      });

      for (const question of questions) {
        const { options, ...questionData } = question;
        const storedQuestion = await client.conceptAssessmentQuestion.upsert({
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

        await client.conceptAssessmentOption.deleteMany({
          where: {
            questionId: storedQuestion.id,
            position: { notIn: options.map((option) => option.position) },
          },
        });

        for (const option of options) {
          await client.conceptAssessmentOption.upsert({
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
    },
    async replaceQuizQuestions(quizId, questions) {
      await client.question.deleteMany({
        where: {
          quizId,
          position: { notIn: questions.map((question) => question.position) },
        },
      });
      for (const question of questions) {
        const { options, ...questionData } = question;
        const storedQuestion = await client.question.upsert({
          where: { quizId_position: { position: question.position, quizId } },
          create: { ...questionData, quizId },
          update: questionData,
          select: { id: true },
        });
        await client.questionOption.deleteMany({
          where: {
            questionId: storedQuestion.id,
            position: { notIn: options.map((option) => option.position) },
          },
        });
        for (const option of options) {
          await client.questionOption.upsert({
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
    },
    async replaceConceptResources(conceptId, resourceIds) {
      if (resourceIds.length === 0) {
        await client.conceptResource.deleteMany({ where: { conceptId } });
        return;
      }

      await client.conceptResource.deleteMany({ where: { conceptId } });
      await client.conceptResource.createMany({
        data: resourceIds.map((resourceId) => ({ conceptId, resourceId })),
      });
    },
    async replaceLessonSequence({ items, lessonId }) {
      const references = items.map((item) => ({
        key: item.key,
        kind: item.kind,
      }));
      await neutralizeObsoleteSequencePointers(client, {
        lessonId,
        references,
      });
      await client.lessonSequenceItem.deleteMany({
        where: {
          lessonId,
          NOT: references.length > 0 ? { OR: references } : undefined,
        },
      });
      await client.lessonSequenceItem.updateMany({
        where: { lessonId },
        data: { position: { increment: 1_000_000 } },
      });

      for (const [index, item] of items.entries()) {
        const target = {
          contentBlockId:
            item.kind === LessonSequenceKind.CONTENT ? item.targetId : null,
          resourceId:
            item.kind === LessonSequenceKind.RESOURCE ? item.targetId : null,
          taskId: item.kind === LessonSequenceKind.TASK ? item.targetId : null,
          conceptAssessmentId:
            item.kind === LessonSequenceKind.CONCEPT_ASSESSMENT
              ? item.targetId
              : null,
          exerciseId:
            item.kind === LessonSequenceKind.EXERCISE ? item.targetId : null,
          quizId: item.kind === LessonSequenceKind.QUIZ ? item.targetId : null,
        };
        const existing = await client.lessonSequenceItem.findUnique({
          where: {
            lessonId_kind_key: { key: item.key, kind: item.kind, lessonId },
          },
          select: {
            conceptAssessmentId: true,
            contentBlockId: true,
            exerciseId: true,
            quizId: true,
            resourceId: true,
            taskId: true,
          },
        });
        if (
          existing &&
          (existing.contentBlockId !== target.contentBlockId ||
            existing.resourceId !== target.resourceId ||
            existing.taskId !== target.taskId ||
            existing.conceptAssessmentId !== target.conceptAssessmentId ||
            existing.exerciseId !== target.exerciseId ||
            existing.quizId !== target.quizId)
        ) {
          throw new Error(
            `Immutable lesson sequence target changed for "${item.kind}:${item.key}".`,
          );
        }
        await client.lessonSequenceItem.upsert({
          where: {
            lessonId_kind_key: { key: item.key, kind: item.kind, lessonId },
          },
          create: {
            ...target,
            key: item.key,
            kind: item.kind,
            lessonId,
            position: index + 1,
          },
          update: { position: index + 1 },
          select: { id: true },
        });
      }
    },
    async upsertContentBlock(input) {
      const { key, lessonId, position, ...data } = input;

      return client.contentBlock.upsert({
        where: { lessonId_key: { key, lessonId } },
        create: { key, lessonId, position, ...data },
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
      const { key, lessonId, ...data } = input;
      return client.conceptAssessment.upsert({
        where: { lessonId_key: { key, lessonId } },
        create: { key, lessonId, ...data },
        update: data,
        select: { id: true },
      });
    },
    async upsertLesson(input) {
      const { canonicalKey, moduleId, slug, ...data } = input;

      return client.lesson.upsert({
        where: { moduleId_slug: { moduleId, slug } },
        create: { canonicalKey, moduleId, slug, ...data },
        update: data,
      });
    },
    async upsertExercise(input) {
      const { lessonId, position, ...data } = input;

      return client.exercise.upsert({
        where: { lessonId_position: { lessonId, position } },
        create: { isCanonical: true, lessonId, position, ...data },
        update: { ...data, isCanonical: true },
      });
    },
    async upsertModule(input) {
      const { canonicalKey, stageId, slug, ...data } = input;

      return client.module.upsert({
        where: { stageId_slug: { stageId, slug } },
        create: { canonicalKey, stageId, slug, ...data },
        update: data,
      });
    },
    async upsertProgram(input) {
      const { canonicalProgramKey, locale, ownerId, slug, ...data } = input;

      return client.program.upsert({
        where: { ownerId_slug: { ownerId, slug } },
        create: { canonicalProgramKey, locale, ownerId, slug, ...data },
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
    async upsertQuiz(input) {
      const { key, lessonId, ...data } = input;
      return client.quiz.upsert({
        where: { lessonId_key: { key, lessonId } },
        create: { key, lessonId, ...data },
        update: data,
        select: { id: true },
      });
    },
    async upsertStage(input) {
      const { canonicalKey, programId, slug, ...data } = input;

      return client.stage.upsert({
        where: { programId_slug: { programId, slug } },
        create: { canonicalKey, programId, slug, ...data },
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
        create: { isCanonical: true, lessonId, position, ...data },
        update: { ...data, isCanonical: true },
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

    const seeds = await readSelectedSeeds();

    await prisma.$transaction(async (transaction) => {
      const repository = createSeedProgramRepository(transaction);

      for (const seed of seeds) {
        await seedSampleProgram(
          repository,
          owner.id,
          seed.program,
          seed.conceptAssessmentBanks,
        );
      }
    }, SAMPLE_PROGRAM_SEED_TRANSACTION_OPTIONS);

    console.info(
      `Programs seeded successfully: ${seeds.map(({ program }) => program.slug).join(', ')}.`,
    );
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
