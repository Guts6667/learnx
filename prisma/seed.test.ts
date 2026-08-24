import { readFile } from 'node:fs/promises';

import { getCorrectionContractRuntimeEligibility } from '../src/lib/ai-correction-contracts';

import {
  SAMPLE_PROGRAM_SEED_TRANSACTION_OPTIONS,
  createSeedProgramRepository,
  getSelectedSeedSlugs,
  readOfficineExpressSeed,
  readPilotageProjetsIaSeed,
  readPlatformApmInterviewSeed,
  readPsychologyFoundationsPilotSeed,
  readSampleProgram,
  readSampleSeed,
  readSourceLabAiSeed,
  readSourceLabProductionSeed,
  seedSampleProgram,
  type SeedProgramRepository,
} from './seed';

type PlatformApmSeed = Awaited<ReturnType<typeof readPlatformApmInterviewSeed>>;
type PlatformApmLesson =
  PlatformApmSeed['program']['stages'][number]['modules'][number]['lessons'][number];

type PlatformApmLessonSidecar = {
  editorial: {
    assessmentBanks: PlatformApmSeed['conceptAssessmentBanks'][number]['assessmentBanks'];
    contentBlockSources: Array<{
      contentBlockPosition: number;
      referenceLinks: Array<{ referenceId: string }>;
    }>;
    references: Array<{ id: string }>;
    resourceChecks: Array<{
      referenceIds: string[];
      resourceKey: string;
    }>;
    review: {
      linksAndMedia: boolean;
      pedagogicalAlignment: boolean;
      readyForPublication: boolean;
      seedCompatibility: boolean;
    };
  };
  lesson: PlatformApmLesson;
  moduleSlug: string;
  programSlug: string;
  specId: string;
  stageSlug: string;
};

type PsychologyPilotSeed = Awaited<
  ReturnType<typeof readPsychologyFoundationsPilotSeed>
>;
type PsychologyPilotLesson =
  PsychologyPilotSeed['program']['stages'][number]['modules'][number]['lessons'][number];
type PsychologyPilotLessonSidecar = {
  editorial: {
    assessmentBanks: PsychologyPilotSeed['conceptAssessmentBanks'][number]['assessmentBanks'];
    contentBlockSources: Array<{
      contentBlockPosition: number;
      referenceLinks: Array<{ referenceId: string }>;
    }>;
    references: Array<{ id: string }>;
    resourceChecks: Array<{ referenceIds: string[]; resourceKey: string }>;
    review: { readyForPublication: boolean };
  };
  lesson: PsychologyPilotLesson;
  moduleSlug: string;
  programSlug: string;
  specId: string;
  stageSlug: string;
};

type PsychologyPilotStageAssessmentSidecar = {
  assessment: {
    description: string;
    rubric: Array<{ weight: number }>;
    seed: Pick<
      PsychologyPilotSeed['program']['stages'][number]['assessment'],
      'isRequired' | 'passingScore' | 'title' | 'type'
    >;
  };
  editorial: {
    review: { readyForPublication: boolean };
  };
  programSlug: string;
  stageSlug: string;
};

type PlatformApmStageAssessmentSidecar = {
  assessment: {
    conceptSlugs: string[];
    rubric: Array<{ weight: number }>;
    seed: PlatformApmSeed['program']['stages'][number]['assessment'];
  };
  editorial: {
    review: { readyForPublication: boolean };
  };
  programSlug: string;
  specId: string;
  stageSlug: string;
};

type PilotageProjetsIaSeed = Awaited<
  ReturnType<typeof readPilotageProjetsIaSeed>
>;
type PilotageProjetsIaLesson =
  PilotageProjetsIaSeed['program']['stages'][number]['modules'][number]['lessons'][number];

type PilotageProjetsIaLessonSidecar = {
  editorial: {
    assessmentBanks: PilotageProjetsIaSeed['conceptAssessmentBanks'][number]['assessmentBanks'];
    contentBlockSources: Array<{
      contentBlockPosition: number;
      notApplicableReason: string | null;
      referenceLinks: Array<{ referenceId: string }>;
    }>;
    references: Array<{ id: string }>;
    resourceChecks: Array<{
      referenceIds: string[];
      resourceKey: string;
    }>;
    review: {
      linksAndMedia: boolean;
      pedagogicalAlignment: boolean;
      readyForPublication: boolean;
      seedCompatibility: boolean;
    };
    status: string;
  };
  lesson: PilotageProjetsIaLesson;
  moduleSlug: string;
  programSlug: string;
  specId: string;
  stageSlug: string;
};

type PilotageProjetsIaStageAssessmentSidecar = {
  assessment: {
    case: string;
    conceptSlugs: string[];
    description: string;
    estimatedMinutes: number;
    instructions: string[];
    remediation: string;
    rubric: Array<{ weight: number }>;
    seed: PilotageProjetsIaSeed['program']['stages'][number]['assessment'];
    submissionFormat: string;
  };
  editorial: {
    review: { readyForPublication: boolean };
    status: string;
  };
  programSlug: string;
  specId: string;
  stageSlug: string;
};

describe('seed transaction budget', () => {
  it('keeps enough time to import the complete sample curriculum atomically', () => {
    expect(SAMPLE_PROGRAM_SEED_TRANSACTION_OPTIONS).toEqual({
      maxWait: 10_000,
      timeout: 600_000,
    });
  });
});

describe('seed program selection', () => {
  it('imports every maintained bundle by default', () => {
    expect(getSelectedSeedSlugs({})).toEqual([
      'fondamentaux-psychologie',
      'officine-express',
      'platform-apm-entretien-tryhackme',
      'pilotage-projets-ia-iso-42001',
      'psychology-foundations-pilot',
      'ingenieur-logiciel-production-sourcelab',
      'ai-product-engineer-sourcelab',
    ]);
  });

  it('can isolate the Platform APM import', () => {
    expect(
      getSelectedSeedSlugs({
        LEARNX_SEED_PROGRAM_SLUG: 'platform-apm-entretien-tryhackme',
      }),
    ).toEqual(['platform-apm-entretien-tryhackme']);
  });

  it('peut isoler le programme de pilotage de projets IA', () => {
    expect(
      getSelectedSeedSlugs({
        LEARNX_SEED_PROGRAM_SLUG: 'pilotage-projets-ia-iso-42001',
      }),
    ).toEqual(['pilotage-projets-ia-iso-42001']);
  });

  it('can isolate the English psychology pilot import', () => {
    expect(
      getSelectedSeedSlugs({
        LEARNX_SEED_PROGRAM_SLUG: 'psychology-foundations-pilot',
      }),
    ).toEqual(['psychology-foundations-pilot']);
  });

  it.each([
    'ingenieur-logiciel-production-sourcelab',
    'ai-product-engineer-sourcelab',
  ])('peut isoler le programme SourceLab %s', (slug) => {
    expect(getSelectedSeedSlugs({ LEARNX_SEED_PROGRAM_SLUG: slug })).toEqual([
      slug,
    ]);
  });

  it('rejects an unknown program instead of falling back to the full seed', () => {
    expect(() =>
      getSelectedSeedSlugs({ LEARNX_SEED_PROGRAM_SLUG: 'unknown-program' }),
    ).toThrow('Unsupported LEARNX_SEED_PROGRAM_SLUG');
  });
});

describe('lesson sequence pointer cleanup', () => {
  it('neutralise uniquement le pointeur vers une activité retirée', async () => {
    const findMany = vi.fn(async () => [{ id: 'obsolete-sequence-item' }]);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const repository = createSeedProgramRepository({
      lessonProgress: { updateMany },
      lessonSequenceItem: { findMany },
    } as never);

    await repository.prepareLessonSequenceUpdate({
      lessonId: 'lesson-1',
      references: [{ key: 'content-1', kind: 'CONTENT' }],
    });

    expect(findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        lessonId: 'lesson-1',
        NOT: { OR: [{ key: 'content-1', kind: 'CONTENT' }] },
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      data: { currentSequenceItemId: null },
      where: {
        currentSequenceItemId: { in: ['obsolete-sequence-item'] },
        lessonId: 'lesson-1',
      },
    });
  });
});

function createRepository() {
  const assessments = new Map<string, string>();
  const assessmentQuestions = new Map<
    string,
    Parameters<SeedProgramRepository['replaceConceptAssessmentQuestions']>[1]
  >();
  const conceptResources = new Map<string, string[]>();
  const taskResources = new Map<string, string[]>();
  const concepts = new Map<string, string>();
  const contentBlocks = new Map<string, string>();
  const exercises = new Map<string, string>();
  const exerciseInputs = new Map<
    string,
    Parameters<SeedProgramRepository['upsertExercise']>[0]
  >();
  const programs = new Map<string, string>();
  const stages = new Map<string, string>();
  const stageAssessments = new Map<string, string>();
  const stageAssessmentInputs = new Map<
    string,
    Parameters<SeedProgramRepository['upsertStageAssessment']>[0]
  >();
  const modules = new Map<string, string>();
  const lessons = new Map<string, string>();
  const resources = new Map<string, string>();
  const quizzes = new Map<string, string>();
  const sequences = new Map<
    string,
    Parameters<SeedProgramRepository['replaceLessonSequence']>[0]['items']
  >();
  const tasks = new Map<string, string>();

  const repository: SeedProgramRepository = {
    async archiveExerciseMirror(input) {
      exercises.delete(`${input.lessonId}:${input.key}`);
    },
    async archiveTaskMirror(input) {
      tasks.delete(`${input.lessonId}:${input.key}`);
    },
    async deleteConceptsNotIn(lessonId, slugs) {
      for (const key of concepts.keys()) {
        if (
          key.startsWith(`${lessonId}:`) &&
          !slugs.includes(key.split(':')[1])
        ) {
          concepts.delete(key);
        }
      }
    },
    async deleteConceptAssessmentsNotIn(conceptId, positions) {
      for (const key of assessments.keys()) {
        const [storedConceptId, position] = key.split(':');

        if (
          storedConceptId === conceptId &&
          !positions.includes(Number(position))
        ) {
          const assessmentId = assessments.get(key);
          assessments.delete(key);
          if (assessmentId) assessmentQuestions.delete(assessmentId);
        }
      }
    },
    async pruneEditorialContent(input) {
      for (const key of contentBlocks.keys()) {
        const [lessonId, contentBlockKey] = key.split(':');

        if (
          lessonId === input.lessonId &&
          !input.contentBlockKeys.includes(contentBlockKey)
        ) {
          contentBlocks.delete(key);
        }
      }

      for (const key of resources.keys()) {
        const [lessonId, resourceKey] = key.split(':');

        if (
          lessonId === input.lessonId &&
          !input.resourceKeys.includes(resourceKey)
        ) {
          resources.delete(key);
        }
      }
    },
    async pruneExercises(lessonId, positions) {
      for (const key of exercises.keys()) {
        const [storedLessonId, position] = key.split(':');

        if (
          storedLessonId === lessonId &&
          !positions.includes(Number(position))
        ) {
          exercises.delete(key);
        }
      }
    },
    async pruneCanonicalActivities(input) {
      for (const key of tasks.keys()) {
        const [lessonId, activityKey] = key.split(':');
        if (
          lessonId === input.lessonId &&
          !input.taskKeys.includes(activityKey)
        ) {
          tasks.delete(key);
        }
      }
      for (const key of exercises.keys()) {
        const [lessonId, activityKey] = key.split(':');
        if (
          lessonId === input.lessonId &&
          !input.exerciseKeys.includes(activityKey)
        ) {
          exercises.delete(key);
        }
      }
    },
    async pruneQuizzes(lessonId, keys) {
      for (const key of quizzes.keys()) {
        const [storedLessonId, quizKey] = key.split(':');
        if (storedLessonId === lessonId && !keys.includes(quizKey)) {
          quizzes.delete(key);
        }
      }
    },
    async prepareLessonSequenceUpdate() {},
    async replaceConceptAssessmentQuestions(assessmentId, questions) {
      assessmentQuestions.set(assessmentId, questions);
    },
    async replaceConceptResources(conceptId, resourceIds) {
      conceptResources.set(conceptId, resourceIds);
    },
    async replaceQuizQuestions() {},
    async replaceLessonSequence({ items, lessonId }) {
      sequences.set(lessonId, structuredClone(items));
    },
    async replaceTaskResources(taskId, resourceIds) {
      taskResources.set(taskId, resourceIds);
    },
    async syncActivityCarryovers() {},
    async upsertContentBlock(input) {
      const key = `${input.lessonId}:${input.key}`;
      const id = contentBlocks.get(key) ?? `block-${contentBlocks.size + 1}`;

      contentBlocks.set(key, id);
      return { id };
    },
    async upsertConcept(input) {
      const key = `${input.lessonId}:${input.slug}`;
      const id = concepts.get(key) ?? `concept-${concepts.size + 1}`;

      concepts.set(key, id);
      return { id };
    },
    async upsertConceptAssessment(input) {
      const key = `${input.conceptId}:${input.position}`;
      const id = assessments.get(key) ?? `assessment-${assessments.size + 1}`;

      assessments.set(key, id);
      return { id };
    },
    async upsertLesson(input) {
      const key = `${input.moduleId}:${input.slug}`;
      const id = lessons.get(key) ?? `lesson-${lessons.size + 1}`;

      lessons.set(key, id);
      return { id };
    },
    async upsertExercise(input) {
      const key = `${input.lessonId}:${input.key}`;
      const id = exercises.get(key) ?? `exercise-${exercises.size + 1}`;

      exercises.set(key, id);
      exerciseInputs.set(key, structuredClone(input));
      return { id };
    },
    async upsertModule(input) {
      const key = `${input.stageId}:${input.slug}`;
      const id = modules.get(key) ?? `module-${modules.size + 1}`;

      modules.set(key, id);
      return { id };
    },
    async upsertProgram(input) {
      const key = `${input.ownerId}:${input.slug}`;
      const id = programs.get(key) ?? `program-${programs.size + 1}`;

      programs.set(key, id);
      return { id };
    },
    async upsertResource(input) {
      const key = `${input.lessonId}:${input.key}`;
      const id = resources.get(key) ?? `resource-${resources.size + 1}`;

      resources.set(key, id);
      return { id };
    },
    async upsertQuiz(input) {
      const key = `${input.lessonId}:${input.key}`;
      const id = quizzes.get(key) ?? `quiz-${quizzes.size + 1}`;
      quizzes.set(key, id);
      return { id };
    },
    async upsertStage(input) {
      const key = `${input.programId}:${input.slug}`;
      const id = stages.get(key) ?? `stage-${stages.size + 1}`;

      stages.set(key, id);
      return { id };
    },
    async upsertStageAssessment(input) {
      const key = `${input.stageId}:${input.position}`;
      const id =
        stageAssessments.get(key) ??
        `stage-assessment-${stageAssessments.size + 1}`;

      stageAssessments.set(key, id);
      stageAssessmentInputs.set(key, input);
      return { id };
    },
    async upsertTask(input) {
      const key = `${input.lessonId}:${input.key}`;
      const id = tasks.get(key) ?? `task-${tasks.size + 1}`;

      tasks.set(key, id);
      return { id };
    },
  };

  return {
    assessments,
    assessmentQuestions,
    conceptResources,
    concepts,
    contentBlocks,
    exercises,
    exerciseInputs,
    lessons,
    modules,
    programs,
    repository,
    resources,
    sequences,
    stages,
    stageAssessments,
    stageAssessmentInputs,
    tasks,
    taskResources,
  };
}

describe('sample program seed', () => {
  it.each([
    {
      assessmentNumbers: [27, 28, 29, 30],
      directory: 'ingenieur-logiciel-production-sourcelab',
      readSeed: readSourceLabProductionSeed,
      slug: 'ingenieur-logiciel-production-sourcelab',
      specNumbers: [126, 127, 128, 129, 130, 131, 132, 133],
    },
    {
      assessmentNumbers: [31, 32, 33, 34],
      directory: 'ai-product-engineer-sourcelab',
      readSeed: readSourceLabAiSeed,
      slug: 'ai-product-engineer-sourcelab',
      specNumbers: [134, 135, 136, 137, 138, 139, 140, 141],
    },
  ])(
    'lit, contrôle et importe le programme SourceLab $slug de façon idempotente',
    async ({ assessmentNumbers, directory, readSeed, slug, specNumbers }) => {
      const seed = await readSeed();
      const context = createRepository();
      const lessons = seed.program.stages.flatMap((stage) =>
        stage.modules.flatMap((module) => module.lessons),
      );

      expect(seed.program).toMatchObject({
        locale: 'fr',
        slug,
        status: 'draft',
      });
      expect(seed.program.stages).toHaveLength(4);
      expect(lessons).toHaveLength(8);
      expect(seed.conceptAssessmentBanks).toHaveLength(8);
      expect(lessons.every((lesson) => lesson.concepts.length === 1)).toBe(
        true,
      );
      expect(lessons.every((lesson) => lesson.tasks.length === 1)).toBe(true);
      expect(lessons.every((lesson) => lesson.quizzes.length === 1)).toBe(true);

      for (const number of specNumbers) {
        const sidecar = JSON.parse(
          await readFile(
            `content/${directory}/specs/PEDAGOGY_SPEC_${String(number).padStart(3, '0')}.json`,
            'utf8',
          ),
        ) as {
          editorial: {
            assessmentBanks: (typeof seed.conceptAssessmentBanks)[number]['assessmentBanks'];
            review: { readyForPublication: boolean };
            status: string;
          };
          lesson: (typeof lessons)[number];
          moduleSlug: string;
          programSlug: string;
          stageSlug: string;
        };
        const stage = seed.program.stages.find(
          (candidate) => candidate.slug === sidecar.stageSlug,
        );
        const module = stage?.modules.find(
          (candidate) => candidate.slug === sidecar.moduleSlug,
        );
        const group = seed.conceptAssessmentBanks.find(
          (candidate) =>
            candidate.programSlug === sidecar.programSlug &&
            candidate.stageSlug === sidecar.stageSlug &&
            candidate.moduleSlug === sidecar.moduleSlug &&
            candidate.lessonSlug === sidecar.lesson.slug,
        );

        expect(module?.lessons).toContainEqual(sidecar.lesson);
        expect(group?.assessmentBanks).toEqual(
          sidecar.editorial.assessmentBanks,
        );
        expect(sidecar.editorial.status).toBe('draft');
        expect(sidecar.editorial.review.readyForPublication).toBe(false);
      }

      for (const number of assessmentNumbers) {
        const sidecar = JSON.parse(
          await readFile(
            `content/${directory}/stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_${String(number).padStart(3, '0')}.json`,
            'utf8',
          ),
        ) as {
          assessment: {
            rubric: Array<{ weight: number }>;
            seed: { title: string; type: string };
          };
          editorial: {
            review: { readyForPublication: boolean };
            status: string;
          };
          stageSlug: string;
        };
        const assessment = seed.program.stages.find(
          (stage) => stage.slug === sidecar.stageSlug,
        )?.assessment;

        expect(assessment).toMatchObject(sidecar.assessment.seed);
        expect(assessment?.rubric).toEqual(sidecar.assessment.rubric);
        expect(
          sidecar.assessment.rubric.reduce(
            (total, criterion) => total + criterion.weight,
            0,
          ),
        ).toBe(100);
        expect(sidecar.editorial.status).toBe('draft');
        expect(sidecar.editorial.review.readyForPublication).toBe(false);
      }

      await seedSampleProgram(
        context.repository,
        'user-1',
        seed.program,
        seed.conceptAssessmentBanks,
      );
      await seedSampleProgram(
        context.repository,
        'user-1',
        seed.program,
        seed.conceptAssessmentBanks,
      );

      expect(context.programs).toHaveLength(1);
      expect(context.stages).toHaveLength(4);
      expect(context.modules).toHaveLength(4);
      expect(context.lessons).toHaveLength(8);
      expect(context.concepts).toHaveLength(8);
      expect(context.stageAssessments).toHaveLength(4);
    },
  );

  it('reads and imports the English psychology pilot as an isolated draft', async () => {
    const seed = await readPsychologyFoundationsPilotSeed();
    const context = createRepository();
    const stage = seed.program.stages[0];
    const lessons = seed.program.stages.flatMap((candidateStage) =>
      candidateStage.modules.flatMap((module) => module.lessons),
    );

    expect(seed.program).toMatchObject({
      canonicalProgramKey: 'fondamentaux-psychologie',
      locale: 'en',
      slug: 'psychology-foundations-pilot',
      status: 'draft',
    });
    expect(stage).toMatchObject({
      canonicalKey: 'decouvrir-discipline',
      slug: 'discovering-the-discipline',
    });
    expect(stage.modules[0]).toMatchObject({
      canonicalKey: 'definition-psychologie',
      slug: 'what-is-psychology',
    });
    expect(seed.program.stages).toHaveLength(2);
    expect(seed.program.stages[1]).toMatchObject({
      canonicalKey: 'grands-courants',
      slug: 'understanding-major-schools',
    });
    expect(
      lessons.map(({ canonicalKey, slug }) => ({ canonicalKey, slug })),
    ).toEqual([
      {
        canonicalKey: 'definir-la-psychologie',
        slug: 'defining-psychology',
      },
      {
        canonicalKey: 'grands-domaines',
        slug: 'major-fields-of-psychology',
      },
      {
        canonicalKey: 'metiers-et-ethique',
        slug: 'professions-and-ethics',
      },
      {
        canonicalKey: 'naissance-psychologie-experimentale',
        slug: 'birth-of-experimental-psychology',
      },
      {
        canonicalKey: 'behaviorisme-apprentissage',
        slug: 'behaviorism-and-learning',
      },
      {
        canonicalKey: 'courants-modernes',
        slug: 'cognitivism-humanism-and-psychoanalysis',
      },
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 5)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(seed.conceptAssessmentBanks).toHaveLength(6);
    expect(
      seed.conceptAssessmentBanks.flatMap(
        ({ assessmentBanks }) => assessmentBanks,
      ),
    ).toHaveLength(18);
    expect(
      seed.conceptAssessmentBanks
        .flatMap(({ assessmentBanks }) => assessmentBanks)
        .flatMap(({ questions }) => questions),
    ).toHaveLength(90);
    for (const candidateStage of seed.program.stages) {
      expect(
        candidateStage.assessment.rubric?.reduce(
          (total, criterion) => total + criterion.weight,
          0,
        ),
      ).toBe(100);
    }

    await seedSampleProgram(
      context.repository,
      'user-1',
      seed.program,
      seed.conceptAssessmentBanks,
    );
    await seedSampleProgram(
      context.repository,
      'user-1',
      seed.program,
      seed.conceptAssessmentBanks,
    );

    expect(context.programs).toHaveLength(1);
    expect(context.stages).toHaveLength(2);
    expect(context.modules).toHaveLength(2);
    expect(context.lessons).toHaveLength(6);
    expect(context.concepts).toHaveLength(18);
    expect(context.assessments).toHaveLength(18);
    expect(context.assessmentQuestions).toHaveLength(18);
    expect(context.resources).toHaveLength(22);
    expect(context.tasks).toHaveLength(5);
    expect(context.exercises).toHaveLength(13);
    expect(context.sequences).toHaveLength(6);
    expect(context.stageAssessments).toHaveLength(2);
  });

  it('keeps the English pilot sidecars and seed bundle structurally identical', async () => {
    const seed = await readPsychologyFoundationsPilotSeed();
    const sidecars = await Promise.all(
      [84, 85, 86, 87, 88, 89].map(async (number) => {
        const source = await readFile(
          `content/psychology-foundations-pilot/specs/PEDAGOGY_SPEC_${String(number).padStart(3, '0')}.json`,
          'utf8',
        );
        return JSON.parse(source) as PsychologyPilotLessonSidecar;
      }),
    );

    for (const sidecar of sidecars) {
      const stage = seed.program.stages.find(
        ({ slug }) => slug === sidecar.stageSlug,
      );
      const module = stage?.modules.find(
        ({ slug }) => slug === sidecar.moduleSlug,
      );
      const lesson = module?.lessons.find(
        ({ slug }) => slug === sidecar.lesson.slug,
      );
      const group = seed.conceptAssessmentBanks.find(
        (candidate) =>
          candidate.programSlug === sidecar.programSlug &&
          candidate.stageSlug === sidecar.stageSlug &&
          candidate.moduleSlug === sidecar.moduleSlug &&
          candidate.lessonSlug === sidecar.lesson.slug,
      );
      const resourceKeys = new Set(
        sidecar.lesson.resources.map(({ key }) => key),
      );
      const referenceIds = new Set(
        sidecar.editorial.references.map(({ id }) => id),
      );

      expect(lesson).toEqual(sidecar.lesson);
      expect(group?.assessmentBanks).toEqual(sidecar.editorial.assessmentBanks);
      expect(sidecar.editorial.review.readyForPublication).toBe(false);
      expect(
        new Set(
          sidecar.editorial.resourceChecks.map(
            ({ resourceKey }) => resourceKey,
          ),
        ),
      ).toEqual(resourceKeys);
      for (const block of sidecar.lesson.contentBlocks) {
        expect(block.content.sourceKeys.length).toBeGreaterThan(0);
        expect(
          block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ).toBe(true);
      }
      for (const mapping of sidecar.editorial.contentBlockSources) {
        expect(mapping.referenceLinks.length).toBeGreaterThan(0);
        expect(
          mapping.referenceLinks.every(({ referenceId }) =>
            referenceIds.has(referenceId),
          ),
        ).toBe(true);
      }
    }

    for (const number of [17, 18]) {
      const assessmentSidecar = JSON.parse(
        await readFile(
          `content/psychology-foundations-pilot/stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_${String(number).padStart(3, '0')}.json`,
          'utf8',
        ),
      ) as PsychologyPilotStageAssessmentSidecar;
      const seededStage = seed.program.stages.find(
        ({ slug }) => slug === assessmentSidecar.stageSlug,
      );
      const seededAssessment = seededStage?.assessment;

      expect(assessmentSidecar.programSlug).toBe(seed.program.slug);
      expect(seededStage).toBeDefined();
      expect(seededAssessment).toMatchObject(assessmentSidecar.assessment.seed);
      expect(seededAssessment?.description).toBe(
        assessmentSidecar.assessment.description,
      );
      expect(assessmentSidecar.assessment.rubric).toEqual(
        seededAssessment?.rubric,
      );
      expect(
        assessmentSidecar.assessment.rubric.reduce(
          (total, criterion) => total + criterion.weight,
          0,
        ),
      ).toBe(100);
      expect(assessmentSidecar.editorial.review.readyForPublication).toBe(
        false,
      );
    }

    const translationManifest = JSON.parse(
      await readFile(
        'content/psychology-foundations-pilot/TRANSLATION_MANIFEST_en.json',
        'utf8',
      ),
    ) as {
      source: { structureKeys: string[] };
      target: { structureKeys: string[] };
    };
    expect(translationManifest.target.structureKeys).toEqual(
      translationManifest.source.structureKeys,
    );
  });

  it('lit et importe le pilote Officine Express complet', async () => {
    const seed = await readOfficineExpressSeed();
    const context = createRepository();
    const lessons = seed.program.stages.flatMap((stage) =>
      stage.modules.flatMap((module) => module.lessons),
    );

    expect(seed.program).toMatchObject({
      canonicalProgramKey: 'officine-express',
      locale: 'fr',
      slug: 'officine-express',
      status: 'active',
    });
    expect(seed.program.stages).toHaveLength(1);
    expect(seed.program.stages[0].modules).toHaveLength(3);
    expect(lessons).toHaveLength(7);
    expect(lessons.every((lesson) => lesson.concepts.length === 1)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 1)).toBe(true);
    expect(lessons.every((lesson) => lesson.sequence.length > 0)).toBe(true);
    expect(seed.conceptAssessmentBanks).toHaveLength(7);
    expect(
      seed.conceptAssessmentBanks.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(7);
    expect(
      seed.conceptAssessmentBanks
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(35);
    expect(
      seed.program.stages[0].assessment.rubric.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);

    await seedSampleProgram(
      context.repository,
      'user-1',
      seed.program,
      seed.conceptAssessmentBanks,
    );

    expect(context.programs).toHaveLength(1);
    expect(context.stages).toHaveLength(1);
    expect(context.modules).toHaveLength(3);
    expect(context.lessons).toHaveLength(7);
    expect(context.concepts).toHaveLength(7);
    expect(context.assessments).toHaveLength(7);
    expect(context.assessmentQuestions).toHaveLength(7);
    expect(context.resources).toHaveLength(29);
    expect(context.tasks).toHaveLength(0);
    expect(context.exercises).toHaveLength(7);
    expect(context.sequences).toHaveLength(7);
    expect(context.stageAssessments).toHaveLength(1);
  });

  it('lit et importe le parcours Platform APM complet', async () => {
    const seed = await readPlatformApmInterviewSeed();
    const context = createRepository();
    const modules = seed.program.stages.flatMap((stage) => stage.modules);
    const lessons = modules.flatMap((module) => module.lessons);

    expect(seed.program).toMatchObject({
      canonicalProgramKey: 'platform-apm-entretien-tryhackme',
      locale: 'fr',
      slug: 'platform-apm-entretien-tryhackme',
      status: 'active',
    });
    expect(seed.program.stages).toHaveLength(2);
    expect(modules).toHaveLength(5);
    expect(lessons).toHaveLength(6);
    expect(lessons.every((lesson) => lesson.concepts.length === 1)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 1)).toBe(true);
    expect(lessons.every((lesson) => lesson.sequence.length > 0)).toBe(true);
    expect(seed.conceptAssessmentBanks).toHaveLength(6);
    expect(
      seed.conceptAssessmentBanks
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(30);
    expect(
      seed.program.stages.every(
        (stage) =>
          stage.assessment.rubric?.reduce(
            (total, criterion) => total + criterion.weight,
            0,
          ) === 100,
      ),
    ).toBe(true);

    await seedSampleProgram(
      context.repository,
      'user-1',
      seed.program,
      seed.conceptAssessmentBanks,
    );

    expect(context.programs).toHaveLength(1);
    expect(context.stages).toHaveLength(2);
    expect(context.modules).toHaveLength(5);
    expect(context.lessons).toHaveLength(6);
    expect(context.concepts).toHaveLength(6);
    expect(context.assessments).toHaveLength(6);
    expect(context.assessmentQuestions).toHaveLength(6);
    expect(context.resources).toHaveLength(12);
    expect(context.tasks).toHaveLength(0);
    expect(context.exercises).toHaveLength(6);
    expect(context.sequences).toHaveLength(6);
    expect(context.stageAssessments).toHaveLength(2);
  });

  it('conserve la parité entre les sidecars Platform APM et le bundle seed', async () => {
    const seed = await readPlatformApmInterviewSeed();
    const lessonSidecars = await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const specNumber = String(index + 78).padStart(3, '0');
        const source = await readFile(
          `content/platform-apm-entretien-tryhackme/specs/PEDAGOGY_SPEC_${specNumber}.json`,
          'utf8',
        );

        return JSON.parse(source) as PlatformApmLessonSidecar;
      }),
    );
    const assessmentSidecars = await Promise.all(
      [15, 16].map(async (assessmentNumber) => {
        const source = await readFile(
          `content/platform-apm-entretien-tryhackme/stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_${String(assessmentNumber).padStart(3, '0')}.json`,
          'utf8',
        );

        return JSON.parse(source) as PlatformApmStageAssessmentSidecar;
      }),
    );

    for (const sidecar of lessonSidecars) {
      expect(sidecar.programSlug).toBe(seed.program.slug);
      const stage = seed.program.stages.find(
        ({ slug }) => slug === sidecar.stageSlug,
      );
      const module = stage?.modules.find(
        ({ slug }) => slug === sidecar.moduleSlug,
      );
      const lesson = module?.lessons.find(
        ({ slug }) => slug === sidecar.lesson.slug,
      );
      const bankGroup = seed.conceptAssessmentBanks.find(
        (group) =>
          group.programSlug === sidecar.programSlug &&
          group.stageSlug === sidecar.stageSlug &&
          group.moduleSlug === sidecar.moduleSlug &&
          group.lessonSlug === sidecar.lesson.slug,
      );

      expect(lesson, `${sidecar.specId}: leçon absente du bundle`).toEqual(
        sidecar.lesson,
      );
      expect(
        bankGroup?.assessmentBanks,
        `${sidecar.specId}: banques différentes du bundle`,
      ).toEqual(sidecar.editorial.assessmentBanks);

      const resourceKeys = new Set(
        sidecar.lesson.resources.map(({ key }) => key),
      );
      const referenceIds = new Set(
        sidecar.editorial.references.map(({ id }) => id),
      );
      const checkedResourceKeys = new Set(
        sidecar.editorial.resourceChecks.map(({ resourceKey }) => resourceKey),
      );
      const sourcedPositions = new Set(
        sidecar.editorial.contentBlockSources.map(
          ({ contentBlockPosition }) => contentBlockPosition,
        ),
      );
      const sequenceReferences = new Set(
        sidecar.lesson.sequence.map(({ key, kind }) => `${kind}:${key}`),
      );

      expect(checkedResourceKeys).toEqual(resourceKeys);
      for (const block of sidecar.lesson.contentBlocks) {
        expect(block.content.sourceKeys.length).toBeGreaterThan(0);
        expect(sourcedPositions).toContain(block.position);
        for (const sourceKey of block.content.sourceKeys) {
          expect(resourceKeys).toContain(sourceKey);
        }
      }
      for (const mapping of sidecar.editorial.contentBlockSources) {
        expect(mapping.referenceLinks.length).toBeGreaterThan(0);
        for (const { referenceId } of mapping.referenceLinks) {
          expect(referenceIds).toContain(referenceId);
        }
      }
      for (const check of sidecar.editorial.resourceChecks) {
        expect(check.referenceIds.length).toBeGreaterThan(0);
        for (const referenceId of check.referenceIds) {
          expect(referenceIds).toContain(referenceId);
        }
      }
      for (const resource of sidecar.lesson.resources.filter(
        ({ isRequired }) => isRequired,
      )) {
        expect(sequenceReferences).toContain(`RESOURCE:${resource.key}`);
      }
      for (const concept of sidecar.lesson.concepts.filter(
        ({ isRequired }) => isRequired,
      )) {
        expect(concept.assessment).toBeDefined();
        expect(
          sidecar.editorial.assessmentBanks.some(
            ({ conceptSlug }) => conceptSlug === concept.slug,
          ),
        ).toBe(true);
      }
      expect(sidecar.editorial.review).toMatchObject({
        linksAndMedia: true,
        pedagogicalAlignment: true,
        readyForPublication: true,
        seedCompatibility: true,
      });
    }

    for (const sidecar of assessmentSidecars) {
      expect(sidecar.programSlug).toBe(seed.program.slug);
      const stage = seed.program.stages.find(
        ({ slug }) => slug === sidecar.stageSlug,
      );
      const conceptSlugs = new Set(
        stage?.modules.flatMap((module) =>
          module.lessons.flatMap((lesson) =>
            lesson.concepts.map(({ slug }) => slug),
          ),
        ) ?? [],
      );

      expect(
        stage?.assessment,
        `${sidecar.specId}: évaluation finale différente du bundle`,
      ).toEqual(sidecar.assessment.seed);
      expect(
        sidecar.assessment.rubric.reduce(
          (total, criterion) => total + criterion.weight,
          0,
        ),
      ).toBe(100);
      for (const conceptSlug of sidecar.assessment.conceptSlugs) {
        expect(conceptSlugs).toContain(conceptSlug);
      }
      expect(sidecar.editorial.review.readyForPublication).toBe(true);
    }
  });

  it('lit et importe le programme de pilotage de projets IA en brouillon', async () => {
    const seed = await readPilotageProjetsIaSeed();
    const context = createRepository();
    const modules = seed.program.stages.flatMap((stage) => stage.modules);
    const lessons = modules.flatMap((module) => module.lessons);

    expect(seed.program).toMatchObject({
      canonicalProgramKey: 'pilotage-projets-ia-iso-42001',
      locale: 'fr',
      slug: 'pilotage-projets-ia-iso-42001',
      status: 'draft',
    });
    expect(seed.program.stages).toHaveLength(8);
    expect(modules).toHaveLength(13);
    expect(lessons).toHaveLength(36);
    expect(lessons.flatMap((lesson) => lesson.concepts)).toHaveLength(88);
    expect(lessons.flatMap((lesson) => lesson.resources)).toHaveLength(89);
    expect(lessons.flatMap((lesson) => lesson.tasks)).toHaveLength(88);
    expect(lessons.every((lesson) => lesson.sequence.length > 0)).toBe(true);
    expect(seed.conceptAssessmentBanks).toHaveLength(36);
    expect(
      seed.conceptAssessmentBanks
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(270);
    expect(
      seed.program.stages.every(
        (stage) =>
          stage.assessment.rubric?.reduce(
            (total, criterion) => total + criterion.weight,
            0,
          ) === 100,
      ),
    ).toBe(true);

    await seedSampleProgram(
      context.repository,
      'user-1',
      seed.program,
      seed.conceptAssessmentBanks,
    );

    expect(context.programs).toHaveLength(1);
    expect(context.stages).toHaveLength(8);
    expect(context.modules).toHaveLength(13);
    expect(context.lessons).toHaveLength(36);
    expect(context.concepts).toHaveLength(88);
    expect(context.assessments).toHaveLength(88);
    expect(context.assessmentQuestions).toHaveLength(88);
    expect(context.resources).toHaveLength(89);
    expect(context.tasks).toHaveLength(4);
    expect(context.exercises).toHaveLength(84);
    expect(context.sequences).toHaveLength(36);
    expect(context.stageAssessments).toHaveLength(8);
  });

  it('conserve la parité entre les sidecars du programme IA et le bundle seed', async () => {
    const seed = await readPilotageProjetsIaSeed();
    const lessonSidecars = await Promise.all(
      Array.from({ length: 36 }, async (_, index) => {
        const specNumber = String(index + 90).padStart(3, '0');
        const source = await readFile(
          `content/pilotage-projets-ia-iso-42001/specs/PEDAGOGY_SPEC_${specNumber}.json`,
          'utf8',
        );

        return JSON.parse(source) as PilotageProjetsIaLessonSidecar;
      }),
    );
    const assessmentSidecars = await Promise.all(
      Array.from({ length: 8 }, async (_, index) => {
        const assessmentNumber = String(index + 19).padStart(3, '0');
        const source = await readFile(
          `content/pilotage-projets-ia-iso-42001/stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_${assessmentNumber}.json`,
          'utf8',
        );

        return JSON.parse(source) as PilotageProjetsIaStageAssessmentSidecar;
      }),
    );

    for (const sidecar of lessonSidecars) {
      expect(sidecar.programSlug).toBe(seed.program.slug);
      const stage = seed.program.stages.find(
        ({ slug }) => slug === sidecar.stageSlug,
      );
      const module = stage?.modules.find(
        ({ slug }) => slug === sidecar.moduleSlug,
      );
      const lesson = module?.lessons.find(
        ({ slug }) => slug === sidecar.lesson.slug,
      );
      const bankGroup = seed.conceptAssessmentBanks.find(
        (group) =>
          group.programSlug === sidecar.programSlug &&
          group.stageSlug === sidecar.stageSlug &&
          group.moduleSlug === sidecar.moduleSlug &&
          group.lessonSlug === sidecar.lesson.slug,
      );

      expect(lesson, `${sidecar.specId}: leçon absente du bundle`).toEqual(
        sidecar.lesson,
      );
      expect(
        bankGroup?.assessmentBanks,
        `${sidecar.specId}: banques différentes du bundle`,
      ).toEqual(sidecar.editorial.assessmentBanks);

      const resourceKeys = new Set(
        sidecar.lesson.resources.map(({ key }) => key),
      );
      const referenceIds = new Set(
        sidecar.editorial.references.map(({ id }) => id),
      );
      const checkedResourceKeys = new Set(
        sidecar.editorial.resourceChecks.map(({ resourceKey }) => resourceKey),
      );
      const sourceMappings = new Map(
        sidecar.editorial.contentBlockSources.map((mapping) => [
          mapping.contentBlockPosition,
          mapping,
        ]),
      );
      const sequenceReferences = new Set(
        sidecar.lesson.sequence.map(({ key, kind }) => `${kind}:${key}`),
      );

      expect(checkedResourceKeys).toEqual(resourceKeys);
      for (const block of sidecar.lesson.contentBlocks) {
        const mapping = sourceMappings.get(block.position);

        expect(
          mapping,
          `${sidecar.specId}: preuve de bloc absente`,
        ).toBeDefined();
        if (block.content.sourceKeys.length === 0) {
          expect(mapping?.referenceLinks).toHaveLength(0);
          expect(mapping?.notApplicableReason).toBeTruthy();
        } else {
          expect(mapping?.referenceLinks.length).toBeGreaterThan(0);
        }
        for (const sourceKey of block.content.sourceKeys) {
          expect(resourceKeys).toContain(sourceKey);
        }
      }
      for (const mapping of sidecar.editorial.contentBlockSources) {
        for (const { referenceId } of mapping.referenceLinks) {
          expect(referenceIds).toContain(referenceId);
        }
      }
      for (const check of sidecar.editorial.resourceChecks) {
        expect(check.referenceIds.length).toBeGreaterThan(0);
        for (const referenceId of check.referenceIds) {
          expect(referenceIds).toContain(referenceId);
        }
      }
      for (const resource of sidecar.lesson.resources.filter(
        ({ isRequired }) => isRequired,
      )) {
        expect(sequenceReferences).toContain(`RESOURCE:${resource.key}`);
      }
      for (const concept of sidecar.lesson.concepts.filter(
        ({ isRequired }) => isRequired,
      )) {
        expect(concept.assessment).toBeDefined();
        expect(
          sidecar.editorial.assessmentBanks.some(
            ({ conceptSlug }) => conceptSlug === concept.slug,
          ),
        ).toBe(true);
      }
      expect(sidecar.editorial.status).toBe('draft');
      expect(sidecar.editorial.review.readyForPublication).toBe(false);
      expect(typeof sidecar.editorial.review.linksAndMedia).toBe('boolean');
      expect(typeof sidecar.editorial.review.pedagogicalAlignment).toBe(
        'boolean',
      );
      expect(typeof sidecar.editorial.review.seedCompatibility).toBe('boolean');
    }

    for (const sidecar of assessmentSidecars) {
      expect(sidecar.programSlug).toBe(seed.program.slug);
      const stage = seed.program.stages.find(
        ({ slug }) => slug === sidecar.stageSlug,
      );
      const conceptSlugs = new Set(
        stage?.modules.flatMap((module) =>
          module.lessons.flatMap((lesson) =>
            lesson.concepts.map(({ slug }) => slug),
          ),
        ) ?? [],
      );

      expect(
        stage?.assessment,
        `${sidecar.specId}: métadonnées d’évaluation différentes du bundle`,
      ).toMatchObject(sidecar.assessment.seed);
      expect(stage?.assessment.description).toBe(
        sidecar.assessment.description,
      );
      expect(stage?.assessment.rubric).toEqual(sidecar.assessment.rubric);
      expect(stage?.assessment.instructions).toContain(
        `${sidecar.assessment.estimatedMinutes} minutes`,
      );
      expect(stage?.assessment.instructions).toContain(sidecar.assessment.case);
      expect(stage?.assessment.instructions).toContain(
        sidecar.assessment.submissionFormat,
      );
      expect(stage?.assessment.instructions).toContain(
        sidecar.assessment.remediation,
      );
      for (const instruction of sidecar.assessment.instructions) {
        expect(stage?.assessment.instructions).toContain(instruction);
      }
      expect(
        sidecar.assessment.rubric.reduce(
          (total, criterion) => total + criterion.weight,
          0,
        ),
      ).toBe(100);
      expect(conceptSlugs).toEqual(new Set(sidecar.assessment.conceptSlugs));
      expect(sidecar.editorial.status).toBe('draft');
      expect(sidecar.editorial.review.readyForPublication).toBe(false);
    }

    const totalMinutes =
      lessonSidecars.reduce(
        (total, sidecar) => total + (sidecar.lesson.estimatedMinutes ?? 0),
        0,
      ) +
      assessmentSidecars.reduce(
        (total, sidecar) => total + sidecar.assessment.estimatedMinutes,
        0,
      );
    expect(totalMinutes).toBe(2_880);
    expect(seed.program.status).toBe('draft');
  });

  it('reads the curriculum hierarchy from the example JSON', async () => {
    const sampleProgram = await readSampleProgram();

    expect(sampleProgram).toMatchObject({
      canonicalProgramKey: 'fondamentaux-psychologie',
      locale: 'fr',
      slug: 'fondamentaux-psychologie',
    });
    expect(sampleProgram.stages).toHaveLength(13);
    expect(sampleProgram.stages.flatMap((stage) => stage.modules)).toHaveLength(
      22,
    );
  });

  it('importe un guidage approuvé pour chaque ressource de psychologie', async () => {
    const sampleProgram = await readSampleProgram();
    const lessons = sampleProgram.stages.flatMap((stage) =>
      stage.modules.flatMap((module) => module.lessons),
    );

    for (const lesson of lessons) {
      const resourceKeys = new Set(lesson.resources.map(({ key }) => key));
      for (const resource of lesson.resources) {
        expect(resource.guidance?.objective).toBeTruthy();
        expect(resource.guidance?.instructions).toBeTruthy();
        expect(resource.guidance?.urlStatus).toMatch(
          /^(ok|redirect|restricted|broken)$/,
        );
        const alternative = resource.guidance?.alternativeResourceKey;
        if (alternative) expect(resourceKeys.has(alternative)).toBe(true);
      }
    }
  });

  it('lit les trois leçons et les neuf banques de la première étape', async () => {
    const sampleSeed = await readSampleSeed();
    const lessons = sampleSeed.program.stages[0].modules[0].lessons.slice(0, 3);
    const lesson = lessons[0];

    expect(lesson.title).toBe('Définir la psychologie');
    expect(lessons.map((item) => item.title)).toEqual([
      'Définir la psychologie',
      'Les grands domaines',
      'Les métiers et l’éthique',
    ]);
    expect(lessons.every((item) => item.contentBlocks.length === 5)).toBe(true);
    expect(lessons.map((item) => item.resources.length)).toEqual([5, 3, 3]);
    expect(lessons.every((item) => item.concepts.length === 3)).toBe(true);
    expect(lessons.every((item) => item.tasks.length === 3)).toBe(true);
    expect(lesson.resources.map((resource) => resource.key)).toEqual([
      'openstax-psychology-2e-1-1',
      'apa-definition-psychology',
      'yale-psyc110-lecture-1',
      'openstax-psychology-2e-2-1',
      'openstax-psychology-2e-2-2',
    ]);
    expect(
      lesson.resources.filter((resource) => resource.isRequired),
    ).toHaveLength(2);
    expect(
      lesson.resources
        .filter((resource) =>
          resource.key.startsWith('openstax-psychology-2e-2-'),
        )
        .every((resource) => !resource.isRequired),
    ).toBe(true);
    expect(
      sampleSeed.conceptAssessmentBanks
        .filter((group) => group.stageSlug === 'decouvrir-discipline')
        .flatMap((group) => group.assessmentBanks),
    ).toHaveLength(9);
    expect(
      sampleSeed.conceptAssessmentBanks
        .filter((group) => group.stageSlug === 'decouvrir-discipline')
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(45);
    const sourceLinks = lessons.flatMap((item) =>
      item.contentBlocks.flatMap((block) => block.content.sourceKeys),
    );

    expect(sourceLinks).toHaveLength(24);
    for (const item of lessons) {
      const resourceKeys = new Set(
        item.resources.map((resource) => resource.key),
      );

      expect(
        item.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }
  });

  it('lit les trois leçons et les neuf banques de la deuxième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'grands-courants',
    );
    const lessons = stage?.modules[0].lessons ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'grands-courants',
    );

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'naissance-psychologie-experimentale',
      'behaviorisme-apprentissage',
      'courants-modernes',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 5)).toBe(
      true,
    );
    expect(lessons.map((lesson) => lesson.resources.length)).toEqual([3, 4, 4]);
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(3);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(9);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(45);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('Comparer plusieurs explications'),
      instructions: expect.stringContaining('## Cas CampusLang'),
      rubric: expect.arrayContaining([
        expect.objectContaining({
          criterion: 'Exactitude historique et conceptuelle',
        }),
      ]),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les huit leçons et les vingt-quatre banques de la troisième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'raisonner-scientifiquement',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'raisonner-scientifiquement',
    );

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'question-hypothese-operationnalisation',
      'correlation-causalite',
      'plans-recherche',
      'echantillonnage-validite',
      'ethique-recherche',
      'anatomie-article',
      'lecture-strategique',
      'hierarchie-preuves',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 5)).toBe(
      true,
    );
    expect(lessons.map((lesson) => lesson.resources.length)).toEqual([
      3, 3, 4, 4, 3, 3, 2, 3,
    ]);
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(
      new Set(
        lessons.flatMap((lesson) => lesson.concepts.map(({ slug }) => slug)),
      ).size,
    ).toBe(24);
    expect(assessmentGroups).toHaveLength(8);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(24);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(120);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('fiche critique'),
      instructions: expect.stringContaining('## Cas RespireCampus'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les trois leçons et les neuf banques de la quatrième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'outils-quantitatifs',
    );
    const lessons = stage?.modules[0].lessons ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'outils-quantitatifs',
    );

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'decrire-donnees',
      'distributions-incertitude',
      'tests-interpretation',
    ]);
    expect(lessons.map((lesson) => lesson.contentBlocks.length)).toEqual([
      5, 5, 6,
    ]);
    expect(lessons.map((lesson) => lesson.resources.length)).toEqual([4, 4, 5]);
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(3);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(9);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(45);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('petit jeu de données fictif'),
      instructions: expect.stringContaining('## Cas PauseFocus'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les quatre leçons et les douze banques de la cinquième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'comprendre-cognition',
    );
    const lessons = stage?.modules[0].lessons ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'comprendre-cognition',
    );

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'apprentissage',
      'memoire',
      'attention-perception',
      'metacognition',
    ]);
    expect(lessons.map((lesson) => lesson.contentBlocks.length)).toEqual([
      5, 6, 6, 6,
    ]);
    expect(lessons.map((lesson) => lesson.resources.length)).toEqual([
      6, 7, 7, 4,
    ]);
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(4);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(12);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(60);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('dispositif fictif de formation'),
      instructions: expect.stringContaining('## Cas SignalClair'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la sixième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'bases-biologiques',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'bases-biologiques',
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'organisation-systeme-nerveux',
      'etudier-cerveau-comportement',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'neurones-communication-plasticite',
      'systemes-nerveux-endocrinien',
      'structures-reseaux-fonctionnels',
      'lesions-neuropsychologie-cas',
      'imagerie-electrophysiologie-inferences',
      'genes-environnement-developpement',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(6);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(18);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(90);
    expect(
      lessons
        .flatMap((lesson) => lesson.resources)
        .every((resource) =>
          ['article', 'book', 'book_chapter', 'document', 'website'].includes(
            resource.type,
          ),
        ),
    ).toBe(true);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('programme fictif'),
      instructions: expect.stringContaining('## Cas CapChange'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la septième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'developpement-vie',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'developpement-vie',
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'cadres-methodes-developpement',
      'fonctions-relations-vie',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'continuite-stades-trajectoires',
      'plans-transversaux-longitudinaux-sequentiels',
      'developpement-prenatal-petite-enfance',
      'developpement-cognitif-langage',
      'attachement-developpement-socioemotionnel',
      'adolescence-age-adulte-vieillissement',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(6);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(18);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(90);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('dossier fictif'),
      instructions: expect.stringContaining('## Cas Trajectoire de Samira'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la huitième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'motivation-emotion-stress',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'motivation-emotion-stress',
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'motivation-action',
      'emotion-adaptation',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'besoins-incitations-buts',
      'motivation-intrinseque-extrinseque',
      'autoregulation-habitudes-persistance',
      'composantes-theories-emotion',
      'regulation-emotionnelle',
      'stress-coping-sante',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(6);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(18);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(90);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('cas fictif'),
      instructions: expect.stringContaining('## Cas Parcours de Nora'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la neuvième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'personnalite-differences-individuelles',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'modeles-personnalite',
      'mesure-interpretation-personnalite',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'approches-traits-big-five',
      'perspectives-biologiques-sociales-narratives',
      'stabilite-changement-situations',
      'fidelite-validite-normes',
      'autoquestionnaires-observation-biais-reponse',
      'usages-limites-ethique-tests',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(6);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(18);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(90);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Cas Horizon 360'),
      rubric: expect.any(Array),
      type: 'case_study',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la dixième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'psychologie-sociale',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'percevoir-influencer',
      'relations-groupes',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'cognition-sociale-attribution-attitudes',
      'persuasion-conformite-obeissance',
      'decision-groupe',
      'identites-relations-intergroupes',
      'stereotypes-prejuges-discrimination',
      'cooperation-conflit-prosocialite',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(6);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(18);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(90);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Cas Maison des Passerelles'),
      rubric: expect.any(Array),
      type: 'case_study',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la onzième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'psychopathologie',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'definir-classifier',
      'familles-troubles',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'normalite-souffrance-handicap-contexte',
      'classification-diagnostic-comorbidite-limites',
      'modeles-biopsychosociaux-trajectoires',
      'troubles-anxieux-obsessionnels-stress',
      'troubles-depressifs-bipolaires',
      'troubles-psychotiques-neurodeveloppementaux-personnalite',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(6);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(18);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(90);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Cas Repères au Point-Relais'),
      rubric: expect.any(Array),
      type: 'case_study',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la douzième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'interventions-applications',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'interventions-psychologiques',
      'psychologie-appliquee',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'evaluation-formulation-decision-partagee',
      'familles-psychotherapies',
      'efficacite-effets-indesirables-alliance-adaptation',
      'sante-prevention',
      'education-apprentissage',
      'travail-ergonomie-organisations',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(6);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(18);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(90);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Cas Campus Horizon'),
      rubric: expect.any(Array),
      type: 'case_study',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les sept leçons et les vingt-et-une banques de la treizième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'integration-preuves',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'science-cumulative-controverses',
      'projet-integrateur',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'replication-transparence-science-ouverte',
      'generalisation-diversite-echantillons-contexte-culturel',
      'communication-publique-desinformation-limites-expertise',
      'formuler-question-delimitee',
      'chercher-hierarchiser-sources',
      'comparer-methodes-resultats',
      'rediger-conclusion-proportionnee-preuves',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(7);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(21);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(105);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Mandat Observatoire Lucide'),
      rubric: expect.any(Array),
      type: 'project',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('conserve les nouveaux sidecars en revue éditoriale non publiable', async () => {
    type EditorialArtifact = {
      editorial: {
        review: { readyForPublication: boolean };
        status: string;
      };
    };
    const fileNames = [
      ...Array.from(
        { length: 31 },
        (_, index) =>
          `content/fondamentaux-psychologie/specs/PEDAGOGY_SPEC_${String(index + 40).padStart(3, '0')}.json`,
      ),
      ...Array.from(
        { length: 5 },
        (_, index) =>
          `content/fondamentaux-psychologie/stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_${String(index + 9).padStart(3, '0')}.json`,
      ),
    ];
    const artifacts = await Promise.all(
      fileNames.map(
        async (fileName) =>
          JSON.parse(await readFile(fileName, 'utf8')) as EditorialArtifact,
      ),
    );

    expect(artifacts).toHaveLength(36);
    expect(
      artifacts.every(
        (artifact) =>
          artifact.editorial.status === 'editorial_review' &&
          artifact.editorial.review.readyForPublication === false,
      ),
    ).toBe(true);
  });

  it('synchronise les preuves éditoriales corrigées des étapes initiales', async () => {
    type LessonSidecar = {
      editorial: {
        review: { scientificAccuracy: boolean; subjectReviewer: string | null };
      };
      lesson: {
        contentBlocks: Array<{ content: { sourceKeys: string[] } }>;
      };
    };
    type AssessmentSidecar = {
      editorial: {
        referenceIds: string[];
        review: { subjectReviewer: string | null };
      };
    };
    const [domains, professions, assessment] = await Promise.all([
      readFile(
        'content/fondamentaux-psychologie/specs/PEDAGOGY_SPEC_002.json',
        'utf8',
      ),
      readFile(
        'content/fondamentaux-psychologie/specs/PEDAGOGY_SPEC_003.json',
        'utf8',
      ),
      readFile(
        'content/fondamentaux-psychologie/stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_002.json',
        'utf8',
      ),
    ]);
    const lessonSidecars = [domains, professions].map(
      (source) => JSON.parse(source) as LessonSidecar,
    );
    const assessmentSidecar = JSON.parse(assessment) as AssessmentSidecar;

    expect(
      lessonSidecars.flatMap((sidecar) => sidecar.lesson.contentBlocks),
    ).toHaveLength(10);
    expect(
      lessonSidecars
        .flatMap((sidecar) => sidecar.lesson.contentBlocks)
        .every((block) => block.content.sourceKeys.length > 0),
    ).toBe(true);
    expect(
      lessonSidecars.every(
        (sidecar) =>
          sidecar.editorial.review.scientificAccuracy === false &&
          sidecar.editorial.review.subjectReviewer === null,
      ),
    ).toBe(true);
    expect(assessmentSidecar.editorial.review.subjectReviewer).toBeNull();
    expect(assessmentSidecar.editorial.referenceIds).toContain(
      'REF-004-WOZNIAK',
    );
  });

  it('respecte les comptes et relations du lot éditorial intégré', async () => {
    const sampleSeed = await readSampleSeed();
    const stages = sampleSeed.program.stages;
    const modules = stages.flatMap((stage) => stage.modules);
    const lessons = modules.flatMap((module) => module.lessons);
    const concepts = lessons.flatMap((lesson) => lesson.concepts);
    const groups = sampleSeed.conceptAssessmentBanks;
    const banks = groups.flatMap((group) => group.assessmentBanks);

    expect(sampleSeed.program.estimatedDurationDays).toBe(120);
    expect(stages).toHaveLength(13);
    expect(modules).toHaveLength(22);
    expect(lessons).toHaveLength(70);
    expect(stages.every((stage) => stage.assessment)).toBe(true);
    expect(concepts).toHaveLength(210);
    expect(concepts.filter((concept) => concept.assessment)).toHaveLength(210);
    expect(groups).toHaveLength(70);
    expect(banks).toHaveLength(210);
    expect(banks.flatMap((bank) => bank.questions)).toHaveLength(1_050);
    expect(lessons.flatMap((lesson) => lesson.contentBlocks)).toHaveLength(403);
    expect(lessons.flatMap((lesson) => lesson.resources)).toHaveLength(400);
    expect(lessons.flatMap((lesson) => lesson.tasks)).toHaveLength(210);
    const passiveTypes = new Set([
      'reading',
      'watching',
      'listening',
      'checklist',
    ]);
    const canonicalTasks = lessons
      .flatMap((lesson) => lesson.tasks)
      .filter((task) => passiveTypes.has(task.type));
    const canonicalExercises = lessons
      .flatMap((lesson) => lesson.tasks)
      .filter((task) => !passiveTypes.has(task.type));

    expect(canonicalTasks).toHaveLength(8);
    expect(canonicalExercises).toHaveLength(202);
    expect(canonicalTasks.every((task) => task.resourceKeys.length > 0)).toBe(
      true,
    );
    expect(
      canonicalExercises.every((task) => task.resourceKeys.length === 0),
    ).toBe(true);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
      expect(
        lesson.concepts.every((concept) =>
          concept.resourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(
      stages.every(
        (stage) =>
          stage.assessment.rubric?.reduce(
            (total, criterion) => total + criterion.weight,
            0,
          ) === 100,
      ),
    ).toBe(true);

    for (const group of groups) {
      const stage = stages.find((item) => item.slug === group.stageSlug);
      const module = stage?.modules.find(
        (item) => item.slug === group.moduleSlug,
      );
      const lesson = module?.lessons.find(
        (item) => item.slug === group.lessonSlug,
      );

      expect(lesson).toBeDefined();
      for (const bank of group.assessmentBanks) {
        const concept = lesson?.concepts.find(
          (item) => item.slug === bank.conceptSlug,
        );

        expect(concept?.assessment).toMatchObject({
          questionCount: bank.questions.length,
          title: bank.assessmentTitle,
        });
      }
    }
  });

  it('refuse une source de bloc absente des ressources de la leçon', async () => {
    const sampleSeed = await readSampleSeed();
    const lesson = sampleSeed.program.stages[0].modules[0].lessons[1];

    lesson.contentBlocks[0].content.sourceKeys.push('source-inconnue');

    await expect(
      seedSampleProgram(
        createRepository().repository,
        'user-1',
        sampleSeed.program,
        sampleSeed.conceptAssessmentBanks,
      ),
    ).rejects.toThrow(
      'Content blocks for "grands-domaines" reference unknown resources: source-inconnue.',
    );
  });

  it('upserts the example program without duplicating its hierarchy', async () => {
    const sampleSeed = await readSampleSeed();
    const {
      assessments,
      assessmentQuestions,
      conceptResources,
      concepts,
      contentBlocks,
      exercises,
      exerciseInputs,
      lessons,
      modules,
      programs,
      repository,
      resources,
      sequences,
      stages,
      stageAssessments,
      stageAssessmentInputs,
      tasks,
      taskResources,
    } = createRepository();

    await seedSampleProgram(
      repository,
      'user-1',
      sampleSeed.program,
      sampleSeed.conceptAssessmentBanks,
    );
    await seedSampleProgram(
      repository,
      'user-1',
      sampleSeed.program,
      sampleSeed.conceptAssessmentBanks,
    );

    expect(programs).toHaveLength(1);
    expect(stages).toHaveLength(13);
    expect(stageAssessments).toHaveLength(13);
    expect(modules).toHaveLength(22);
    expect(lessons).toHaveLength(70);
    expect(concepts).toHaveLength(210);
    expect(assessments).toHaveLength(210);
    expect(assessmentQuestions).toHaveLength(210);
    expect(
      [...assessmentQuestions.values()].reduce(
        (total, questions) => total + questions.length,
        0,
      ),
    ).toBe(1_050);
    expect(contentBlocks).toHaveLength(403);
    expect(resources).toHaveLength(400);
    expect(tasks).toHaveLength(8);
    expect(exercises).toHaveLength(202);
    expect(sequences).toHaveLength(70);
    expect(
      [...sequences.values()].reduce((total, items) => total + items.length, 0),
    ).toBe(1_223);
    expect(
      [...sequences.values()].flat().filter((item) => item.kind === 'RESOURCE'),
    ).toHaveLength(400);
    expect([...tasks.keys()].some((key) => exercises.has(key))).toBe(false);
    expect(
      [...conceptResources.values()].reduce(
        (total, resourceIds) => total + resourceIds.length,
        0,
      ),
    ).toBe(
      sampleSeed.program.stages
        .flatMap((stage) => stage.modules)
        .flatMap((module) => module.lessons)
        .flatMap((item) => item.concepts)
        .reduce((total, concept) => total + concept.resourceKeys.length, 0),
    );
    const firstLessonId = lessons.get('module-1:definir-la-psychologie');
    const objectConceptId = concepts.get(`${firstLessonId}:objet-psychologie`);
    const behaviorConceptId = concepts.get(
      `${firstLessonId}:comportements-processus-mentaux`,
    );
    const empiricalConceptId = concepts.get(
      `${firstLessonId}:demarche-empirique`,
    );
    const openStaxId = resources.get(
      `${firstLessonId}:openstax-psychology-2e-1-1`,
    );
    const apaId = resources.get(`${firstLessonId}:apa-definition-psychology`);
    const yaleId = resources.get(`${firstLessonId}:yale-psyc110-lecture-1`);

    expect(conceptResources.get(objectConceptId ?? '')).toEqual([
      openStaxId,
      apaId,
    ]);
    expect(conceptResources.get(behaviorConceptId ?? '')).toEqual([
      openStaxId,
      yaleId,
    ]);
    expect(conceptResources.get(empiricalConceptId ?? '')).toEqual([
      openStaxId,
    ]);
    const readingTaskId = tasks.get(`${firstLessonId}:activity-1`);
    expect(taskResources.get(readingTaskId ?? '')).toEqual([openStaxId]);
    const objectAssessmentId = assessments.get(`${objectConceptId}:1`);
    const objectQuestions = assessmentQuestions.get(objectAssessmentId ?? '');

    expect(objectQuestions).toHaveLength(5);
    expect(objectQuestions?.[0]).toMatchObject({
      explanation: expect.any(String),
      options: expect.arrayContaining([
        expect.objectContaining({ isCorrect: true }),
      ]),
    });
    expect(tasks.has(`${firstLessonId}:activity-1`)).toBe(true);
    expect(exercises.has(`${firstLessonId}:activity-1`)).toBe(false);
    expect(exercises.has(`${firstLessonId}:activity-2`)).toBe(true);
    expect(exercises.has(`${firstLessonId}:activity-3`)).toBe(true);

    const programId = programs.get('user-1:fondamentaux-psychologie');
    const integrationStageId = stages.get(
      `${programId}:integration-preuves`,
    );
    const projectModuleId = modules.get(
      `${integrationStageId}:projet-integrateur`,
    );
    const pilotLessonId = lessons.get(
      `${projectModuleId}:formuler-question-delimitee`,
    );
    const pilotExercise = exerciseInputs.get(`${pilotLessonId}:activity-2`);

    expect(pilotExercise?.instructions).toContain('Projet A');
    expect(pilotExercise?.instructions).toContain('Projet B');
    expect(pilotExercise?.instructions).toContain('PCC');
    expect(pilotExercise?.instructions).not.toContain('cadre JBI');
    expect(
      getCorrectionContractRuntimeEligibility(pilotExercise?.rubric),
    ).toMatchObject({
      eligible: true,
      contract: {
        contractKey: 'v4-writing-framework-selection-fr',
        lifecycle: { status: 'PUBLISHED' },
        target: { activityKey: 'activity-2', activityType: 'writing' },
      },
    });
    expect(stageAssessmentInputs.get('stage-1:1')).toMatchObject({
      description: expect.stringContaining('projet d’intervention'),
      instructions: expect.stringContaining('## Cas NovaWork'),
      rubric: expect.arrayContaining([
        expect.objectContaining({ criterion: 'Cadrage scientifique' }),
      ]),
    });
    expect(stageAssessmentInputs.get('stage-2:1')).toMatchObject({
      description: expect.stringContaining('plusieurs explications'),
      instructions: expect.stringContaining('## Cas CampusLang'),
      rubric: expect.arrayContaining([
        expect.objectContaining({
          criterion: 'Exactitude historique et conceptuelle',
        }),
      ]),
    });
    expect(stageAssessmentInputs.get('stage-3:1')).toMatchObject({
      description: expect.stringContaining('fiche critique'),
      instructions: expect.stringContaining('## Cas RespireCampus'),
      rubric: expect.any(Array),
    });
  });

  it('refuse une notion obligatoire sans activité de validation', async () => {
    const source = await readSampleProgram();
    const invalidProgram = structuredClone(source);

    invalidProgram.stages[0].modules[0].lessons[0].concepts[0].assessment =
      undefined;

    await expect(
      seedSampleProgram(
        createRepository().repository,
        'user-1',
        invalidProgram,
      ),
    ).rejects.toThrow();
  });
});
