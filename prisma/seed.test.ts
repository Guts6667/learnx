import {
  readSampleProgram,
  seedSampleProgram,
  type SeedProgramRepository,
} from './seed';

function createRepository() {
  const assessments = new Map<string, number>();
  const conceptResources = new Map<string, string[]>();
  const concepts = new Map<string, string>();
  const contentBlocks = new Map<string, string>();
  const programs = new Map<string, string>();
  const stages = new Map<string, string>();
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
    async replaceConceptAssessments(conceptId, inputs) {
      assessments.set(conceptId, inputs.length);
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
    async upsertLesson(input) {
      const key = `${input.moduleId}:${input.slug}`;
      const id = lessons.get(key) ?? `lesson-${lessons.size + 1}`;

      lessons.set(key, id);
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
    async upsertTask(input) {
      const key = `${input.lessonId}:${input.position}`;
      const id = tasks.get(key) ?? `task-${tasks.size + 1}`;

      tasks.set(key, id);
      return { id };
    },
  };

  return {
    assessments,
    conceptResources,
    concepts,
    contentBlocks,
    lessons,
    modules,
    programs,
    repository,
    resources,
    stages,
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

  it('lit exactement le premier contenu pédagogique réel', async () => {
    const sampleProgram = await readSampleProgram();
    const lesson = sampleProgram.stages[0].modules[0].lessons[0];

    expect(lesson.title).toBe('Définir la psychologie');
    expect(lesson.contentBlocks).toHaveLength(5);
    expect(lesson.resources.map((resource) => resource.key)).toEqual([
      'openstax-psychology-2e-1-1',
      'apa-definition-psychology',
      'yale-psyc110-lecture-1',
    ]);
    expect(lesson.tasks).toHaveLength(3);
    expect(lesson.concepts).toHaveLength(3);
    expect(
      lesson.resources.filter((resource) => resource.isRequired),
    ).toHaveLength(2);
  });

  it('upserts the example program without duplicating its hierarchy', async () => {
    const sampleProgram = await readSampleProgram();
    const {
      assessments,
      conceptResources,
      concepts,
      contentBlocks,
      lessons,
      modules,
      programs,
      repository,
      resources,
      stages,
      tasks,
    } = createRepository();

    await seedSampleProgram(repository, 'user-1', sampleProgram);
    await seedSampleProgram(repository, 'user-1', sampleProgram);

    expect(programs).toHaveLength(1);
    expect(stages).toHaveLength(5);
    expect(modules).toHaveLength(6);
    expect(lessons).toHaveLength(21);
    expect(concepts).toHaveLength(23);
    expect(assessments).toHaveLength(23);
    expect([...assessments.values()].every((count) => count === 1)).toBe(true);
    expect(contentBlocks).toHaveLength(5);
    expect(resources).toHaveLength(3);
    expect(tasks).toHaveLength(3);
    expect(
      [...conceptResources.values()].reduce(
        (total, resourceIds) => total + resourceIds.length,
        0,
      ),
    ).toBe(5);
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
