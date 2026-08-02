import {
  readSampleProgram,
  readSampleSeed,
  seedSampleProgram,
  type SeedProgramRepository,
} from './seed';

function createRepository() {
  const assessments = new Map<string, string>();
  const assessmentQuestions = new Map<
    string,
    Parameters<SeedProgramRepository['replaceConceptAssessmentQuestions']>[1]
  >();
  const conceptResources = new Map<string, string[]>();
  const concepts = new Map<string, string>();
  const contentBlocks = new Map<string, string>();
  const exercises = new Map<string, string>();
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
  const tasks = new Map<string, string>();

  const repository: SeedProgramRepository = {
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
        const [lessonId, position] = key.split(':');

        if (
          lessonId === input.lessonId &&
          !input.contentBlockPositions.includes(Number(position))
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

      for (const key of tasks.keys()) {
        const [lessonId, position] = key.split(':');

        if (
          lessonId === input.lessonId &&
          !input.taskPositions.includes(Number(position))
        ) {
          tasks.delete(key);
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
    async replaceConceptAssessmentQuestions(assessmentId, questions) {
      assessmentQuestions.set(assessmentId, questions);
    },
    async replaceConceptResources(conceptId, resourceIds) {
      conceptResources.set(conceptId, resourceIds);
    },
    async upsertContentBlock(input) {
      const key = `${input.lessonId}:${input.position}`;
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
      const key = `${input.lessonId}:${input.position}`;
      const id = exercises.get(key) ?? `exercise-${exercises.size + 1}`;

      exercises.set(key, id);
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
      const key = `${input.lessonId}:${input.position}`;
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
    lessons,
    modules,
    programs,
    repository,
    resources,
    stages,
    stageAssessments,
    stageAssessmentInputs,
    tasks,
  };
}

describe('sample program seed', () => {
  it('reads the curriculum hierarchy from the example JSON', async () => {
    const sampleProgram = await readSampleProgram();

    expect(sampleProgram.slug).toBe('fondamentaux-psychologie');
    expect(sampleProgram.stages).toHaveLength(5);
    expect(sampleProgram.stages.flatMap((stage) => stage.modules)).toHaveLength(
      6,
    );
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
    expect(lessons.every((item) => item.resources.length === 3)).toBe(true);
    expect(lessons.every((item) => item.concepts.length === 3)).toBe(true);
    expect(lessons.every((item) => item.tasks.length === 3)).toBe(true);
    expect(lesson.resources.map((resource) => resource.key)).toEqual([
      'openstax-psychology-2e-1-1',
      'apa-definition-psychology',
      'yale-psyc110-lecture-1',
    ]);
    expect(
      lesson.resources.filter((resource) => resource.isRequired),
    ).toHaveLength(2);
    expect(
      sampleSeed.conceptAssessmentBanks.flatMap(
        (group) => group.assessmentBanks,
      ),
    ).toHaveLength(9);
    expect(
      sampleSeed.conceptAssessmentBanks
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(45);
    const sourceLinks = lessons.flatMap((item) =>
      item.contentBlocks.flatMap((block) => block.content.sourceKeys),
    );

    expect(sourceLinks).toHaveLength(14);
    for (const item of lessons) {
      const resourceKeys = new Set(
        item.resources.map((resource) => resource.key),
      );

      expect(
        item.contentBlocks.every((block) =>
          block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
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
      lessons,
      modules,
      programs,
      repository,
      resources,
      stages,
      stageAssessments,
      stageAssessmentInputs,
      tasks,
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
    expect(stages).toHaveLength(5);
    expect(stageAssessments).toHaveLength(5);
    expect(modules).toHaveLength(6);
    expect(lessons).toHaveLength(21);
    expect(concepts).toHaveLength(27);
    expect(assessments).toHaveLength(27);
    expect(assessmentQuestions).toHaveLength(9);
    expect(
      [...assessmentQuestions.values()].reduce(
        (total, questions) => total + questions.length,
        0,
      ),
    ).toBe(45);
    expect(contentBlocks).toHaveLength(15);
    expect(resources).toHaveLength(9);
    expect(tasks).toHaveLength(9);
    expect(exercises).toHaveLength(9);
    expect(
      [...conceptResources.values()].reduce(
        (total, resourceIds) => total + resourceIds.length,
        0,
      ),
    ).toBe(
      sampleSeed.program.stages[0].modules[0].lessons
        .slice(0, 3)
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
    const objectAssessmentId = assessments.get(`${objectConceptId}:1`);
    const objectQuestions = assessmentQuestions.get(objectAssessmentId ?? '');

    expect(objectQuestions).toHaveLength(5);
    expect(objectQuestions?.[0]).toMatchObject({
      explanation: expect.any(String),
      options: expect.arrayContaining([
        expect.objectContaining({ isCorrect: true }),
      ]),
    });
    expect(exercises.has(`${firstLessonId}:1`)).toBe(true);
    expect(exercises.has(`${firstLessonId}:2`)).toBe(true);
    expect(exercises.has(`${firstLessonId}:3`)).toBe(true);
    expect(stageAssessmentInputs.get('stage-1:1')).toMatchObject({
      description: expect.stringContaining('projet d’intervention'),
      instructions: expect.stringContaining('## Cas NovaWork'),
      rubric: expect.arrayContaining([
        expect.objectContaining({ criterion: 'Cadrage scientifique' }),
      ]),
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
